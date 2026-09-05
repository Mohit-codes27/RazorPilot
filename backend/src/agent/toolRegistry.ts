import type { Prisma } from '@prisma/client';
import { ZodSchema } from 'zod';
import { prisma } from '../db/prisma.js';
import type { AIToolDefinition } from '../providers/ai/aiProvider.js';
import { AuthenticationError, AuthorizationError, ToolExecutionError } from '../utils/errors.js';

/**
 * Tool permission levels. Enforced by backend code — never by model output.
 *
 * PUBLIC_READ             → anyone, no auth
 * USER_AUTHENTICATED      → signed-in user
 * USER_INTENT_REQUIRED    → signed-in user on a user-initiated turn
 * USER_CONFIRMATION_REQUIRED → signed-in user + explicit `confirmed: true`
 * SYSTEM_ONLY             → never executable through the agent path
 */
export type ToolPermission =
  | 'PUBLIC_READ'
  | 'USER_AUTHENTICATED'
  | 'USER_INTENT_REQUIRED'
  | 'USER_CONFIRMATION_REQUIRED'
  | 'SYSTEM_ONLY';

export interface ToolContext {
  sessionId: string;
  /** Null for unauthenticated callers. */
  userId: string | null;
  /** True when this turn was initiated by a user message. */
  intent: boolean;
  /** True only when the request carried explicit user confirmation. */
  confirmed: boolean;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: ZodSchema;
  /** Hand-authored JSON schema for the model's function declarations. */
  aiParameters: AIToolDefinition['parameters'];
  permission: ToolPermission;
  handler: ToolHandler;
}

const registry = new Map<string, RegisteredTool>();

export function defineTool(tool: RegisteredTool): void {
  if (registry.has(tool.name)) {
    throw new Error(`Tool already registered: ${tool.name}`);
  }
  registry.set(tool.name, tool);
}

/** Removes a registration. Used by tests; not part of the runtime API. */
export function unregisterTool(name: string): void {
  registry.delete(name);
}

export function getTool(name: string): RegisteredTool | undefined {
  return registry.get(name);
}

/** Tools visible to the model. SYSTEM_ONLY tools are never offered. */
export function listToolsForAI(): AIToolDefinition[] {
  return [...registry.values()]
    .filter((t) => t.permission !== 'SYSTEM_ONLY')
    .map((t) => ({ name: t.name, description: t.description, parameters: t.aiParameters }));
}

/** Full registry snapshot (name + permission). Used by safety boundary tests. */
export function listRegisteredTools(): Array<{ name: string; permission: ToolPermission }> {
  return [...registry.values()].map((t) => ({ name: t.name, permission: t.permission }));
}

export function checkPermission(tool: RegisteredTool, ctx: ToolContext): void {
  switch (tool.permission) {
    case 'PUBLIC_READ':
      return;
    case 'USER_AUTHENTICATED':
      if (!ctx.userId) throw new AuthenticationError('Sign-in required for this action');
      return;
    case 'USER_INTENT_REQUIRED':
      if (!ctx.userId) throw new AuthenticationError('Sign-in required for this action');
      if (!ctx.intent) throw new AuthorizationError('Clear user intent is required for this action');
      return;
    case 'USER_CONFIRMATION_REQUIRED':
      if (!ctx.userId) throw new AuthenticationError('Sign-in required for this action');
      if (!ctx.confirmed) {
        throw new AuthorizationError('Explicit user confirmation is required for this action');
      }
      return;
    case 'SYSTEM_ONLY':
      throw new AuthorizationError('This action cannot be performed through the assistant');
  }
}

export type ToolCallStatus = 'SUCCEEDED' | 'FAILED' | 'BLOCKED';

export interface ToolExecution {
  status: ToolCallStatus;
  result: unknown;
}

/**
 * Full execution pipeline: name → Zod args → permission → handler →
 * AgentToolCall audit row → sanitized result for the model.
 */
export async function executeTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<ToolExecution> {
  const tool = registry.get(name);
  const argsObject = typeof rawArgs === 'object' && rawArgs !== null ? rawArgs : {};

  if (!tool) {
    await recordToolCall(ctx.sessionId, name, argsObject, { error: 'unknown_tool' }, 'FAILED');
    throw new ToolExecutionError(`Unknown tool: ${name}`);
  }

  const parsedArgs = tool.inputSchema.safeParse(argsObject);
  if (!parsedArgs.success) {
    await recordToolCall(ctx.sessionId, name, argsObject, { error: 'invalid_arguments' }, 'FAILED');
    throw new ToolExecutionError(`Invalid arguments for tool ${name}`);
  }

  try {
    checkPermission(tool, ctx);
  } catch (err) {
    await recordToolCall(ctx.sessionId, name, argsObject, { error: 'blocked' }, 'BLOCKED');
    await recordBlockedAudit(ctx, name);
    throw err;
  }

  try {
    const result = await tool.handler(parsedArgs.data as Record<string, unknown>, ctx);
    const sanitized = sanitizeForModel(result);
    await recordToolCall(ctx.sessionId, name, argsObject, sanitized, 'SUCCEEDED');
    return { status: 'SUCCEEDED', result: sanitized };
  } catch (err) {
    await recordToolCall(ctx.sessionId, name, argsObject, { error: 'handler_failed' }, 'FAILED');
    throw err;
  }
}

async function recordToolCall(
  sessionId: string,
  toolName: string,
  args: unknown,
  result: unknown,
  status: 'SUCCEEDED' | 'FAILED' | 'BLOCKED',
): Promise<void> {
  await prisma.agentToolCall.create({
    data: {
      sessionId,
      toolName,
      arguments: truncate(args),
      result: truncate(result),
      status,
      completedAt: new Date(),
    },
  });
}

/** Cap stored blobs so a chatty tool cannot bloat the audit table. */
function truncate(value: unknown): Prisma.InputJsonValue {
  const json = JSON.stringify(value ?? null);
  const capped = json.length > 8000 ? json.slice(0, 8000) : json;
  return JSON.parse(capped) as Prisma.InputJsonValue;
}

/** Strip anything the model must never see (hashes, tokens, internals). */
function sanitizeForModel(result: unknown): unknown {
  if (Array.isArray(result)) return result.map(sanitizeForModel);
  if (result !== null && typeof result === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
      if (/password|hash|secret|token|key/i.test(k)) continue;
      out[k] = sanitizeForModel(v);
    }
    return out;
  }
  return result;
}

/**
 * Every denied tool attempt leaves an AuditLog trail (spec: TOOL_BLOCKED).
 * Best-effort: audit failures must never break the tool pipeline.
 */
async function recordBlockedAudit(ctx: ToolContext, toolName: string): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        entityType: 'TOOL',
        entityId: null,
        action: 'TOOL_BLOCKED',
        actorType: 'AGENT',
        metadata: { toolName, sessionId: ctx.sessionId },
      },
    });
  } catch {
    // Audit must not break request handling.
  }
}
