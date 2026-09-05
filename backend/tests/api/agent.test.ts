import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../../src/app.js';
import { defineTool, unregisterTool } from '../../src/agent/toolRegistry.js';
import { prisma } from '../../src/db/prisma.js';
import { setAIProviderOverride } from '../../src/providers/ai/index.js';
import type { AIChatResult, AIProvider } from '../../src/providers/ai/aiProvider.js';
import { AIServiceError } from '../../src/utils/errors.js';

const app = createApp();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const emailA = `p7test.a.${stamp}@example.com`;
const emailB = `p7test.b.${stamp}@example.com`;
const password = 'secure-password-1';

let tokenA = '';
let tokenB = '';

class ScriptedAI implements AIProvider {
  readonly name = 'scripted';
  queue: Array<AIChatResult | Error> = [];
  calls = 0;
  async chat(): Promise<AIChatResult> {
    this.calls++;
    const next = this.queue.shift();
    if (!next) return { text: 'done', toolCalls: [] };
    if (next instanceof Error) throw next;
    return next;
  }
}

const ai = new ScriptedAI();

async function register(email: string): Promise<{ token: string; id: string }> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'P7Test', email, password });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, id: res.body.user.id as string };
}

const authA = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
const authB = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);

beforeAll(async () => {
  const a = await register(emailA);
  tokenA = a.token;
  tokenB = (await register(emailB)).token;
  setAIProviderOverride(ai);
});

afterAll(async () => {
  setAIProviderOverride(null);
  const users = await prisma.user.findMany({
    where: { email: { in: [emailA, emailB] } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.agentToolCall.deleteMany({ where: { session: { userId: { in: ids } } } });
    await prisma.agentMessage.deleteMany({ where: { session: { userId: { in: ids } } } });
    await prisma.agentSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
});

async function createSession(token: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/agent/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  expect(res.status).toBe(201);
  return res.body.session.id as string;
}

describe('Phase 7 — agent sessions', () => {
  it('rejects unauthenticated access', async () => {
    expect((await request(app).post('/api/v1/agent/sessions').send({})).status).toBe(401);
  });

  it('creates and retrieves a session with empty history', async () => {
    const id = await createSession(tokenA);
    const res = await authA(request(app).get(`/api/v1/agent/sessions/${id}`));
    expect(res.status).toBe(200);
    expect(res.body.session.id).toBe(id);
    expect(res.body.messages).toEqual([]);
    expect(res.body.toolCalls).toEqual([]);
  });

  it('isolates sessions per user and validates ids', async () => {
    const id = await createSession(tokenA);
    expect((await authB(request(app).get(`/api/v1/agent/sessions/${id}`))).status).toBe(404);
    expect((await authA(request(app).get('/api/v1/agent/sessions/not-a-uuid'))).status).toBe(400);
    expect(
      (await authA(request(app).get('/api/v1/agent/sessions/00000000-0000-0000-0000-000000000000'))).status,
    ).toBe(404);
  });
});

describe('Phase 7 — agent messages (mocked AI)', () => {
  it('returns plain assistant text and persists the turn', async () => {
    const id = await createSession(tokenA);
    ai.queue.push({ text: 'Hello, happy to help you shop.', toolCalls: [] });
    const res = await authA(
      request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: 'Hi' }),
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ session_id: id, message: 'Hello, happy to help you shop.' });
    expect(res.body.tool_calls).toEqual([]);

    const session = await authA(request(app).get(`/api/v1/agent/sessions/${id}`));
    const roles = session.body.messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(['USER', 'ASSISTANT']);
  });

  it('executes a model-requested tool and summarizes the result', async () => {
    const id = await createSession(tokenA);
    ai.queue.push(
      { text: 'Let me check your preferences.', toolCalls: [{ name: 'get_user_preferences', args: {} }] },
      { text: 'I have your preferences now.', toolCalls: [] },
    );
    const res = await authA(
      request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: 'Find me a keyboard' }),
    );
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('I have your preferences now.');
    expect(res.body.tool_calls).toEqual([{ name: 'get_user_preferences', status: 'SUCCEEDED' }]);

    const session = await authA(request(app).get(`/api/v1/agent/sessions/${id}`));
    expect(session.body.toolCalls).toHaveLength(1);
    expect(session.body.toolCalls[0]).toMatchObject({ toolName: 'get_user_preferences', status: 'SUCCEEDED' });
    const roles = session.body.messages.map((m: { role: string }) => m.role);
    expect(roles).toContain('TOOL');
  });

  it('blocks confirmation-gated tools without explicit confirmation', async () => {
    defineTool({
      name: 'tmp_confirm_gated',
      description: 'tmp',
      inputSchema: z.object({}),
      aiParameters: { type: 'OBJECT', properties: {} },
      permission: 'USER_CONFIRMATION_REQUIRED',
      handler: async () => ({ shouldNotHappen: true }),
    });
    try {
      const id = await createSession(tokenA);
      ai.queue.push(
        { text: 'Trying gated tool.', toolCalls: [{ name: 'tmp_confirm_gated', args: {} }] },
        { text: 'Could not proceed without confirmation.', toolCalls: [] },
      );
      const res = await authA(
        request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: 'Do the gated thing' }),
      );
      expect(res.status).toBe(200);
      expect(res.body.tool_calls).toEqual([{ name: 'tmp_confirm_gated', status: 'FAILED' }]);

      const blocked = await prisma.agentToolCall.findFirst({
        where: { sessionId: id, toolName: 'tmp_confirm_gated' },
      });
      expect(blocked?.status).toBe('BLOCKED');
    } finally {
      unregisterTool('tmp_confirm_gated');
    }
  });

  it('rejects invalid tool arguments without crashing', async () => {
    defineTool({
      name: 'tmp_strict_tool',
      description: 'tmp',
      inputSchema: z.object({ required_field: z.string() }),
      aiParameters: { type: 'OBJECT', properties: {} },
      permission: 'PUBLIC_READ',
      handler: async () => ({}),
    });
    try {
      const id = await createSession(tokenA);
      ai.queue.push(
        { text: 'Trying strict tool.', toolCalls: [{ name: 'tmp_strict_tool', args: {} }] },
        { text: 'Those arguments were invalid.', toolCalls: [] },
      );
      const res = await authA(
        request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: 'Use strict tool' }),
      );
      expect(res.status).toBe(200);
      expect(res.body.tool_calls).toEqual([{ name: 'tmp_strict_tool', status: 'FAILED' }]);
    } finally {
      unregisterTool('tmp_strict_tool');
    }
  });

  it('degrades gracefully when the AI service fails (nothing charged/changed)', async () => {
    const id = await createSession(tokenA);
    ai.queue.push(new AIServiceError('provider down'));
    const res = await authA(
      request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: 'Hello?' }),
    );
    expect(res.status).toBe(200);
    expect(res.body.ai_unavailable).toBe(true);
    expect(res.body.tool_calls).toEqual([]);
    expect(await prisma.agentToolCall.count({ where: { sessionId: id } })).toBe(0);
  });

  it('validates message input and session ownership', async () => {
    const id = await createSession(tokenA);
    expect(
      (await authA(request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: '' }))).status,
    ).toBe(400);
    expect(
      (await authB(request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: 'Hi' }))).status,
    ).toBe(404);
    expect(
      (await authA(request(app).post('/api/v1/agent/sessions/not-a-uuid/messages').send({ message: 'Hi' }))).status,
    ).toBe(400);
  });
});
