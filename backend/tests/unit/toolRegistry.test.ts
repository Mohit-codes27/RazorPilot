import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import '../../src/tools/index.js';
import {
  checkPermission,
  defineTool,
  getTool,
  listToolsForAI,
  unregisterTool,
} from '../../src/agent/toolRegistry.js';

describe('Phase 7 — tool permission matrix', () => {
  const base = { sessionId: 's', userId: 'u', intent: true, confirmed: true };
  const cases: Array<{ permission: 'PUBLIC_READ' | 'USER_AUTHENTICATED' | 'USER_INTENT_REQUIRED' | 'USER_CONFIRMATION_REQUIRED' | 'SYSTEM_ONLY'; ctx: typeof base; ok: boolean }> = [
    { permission: 'PUBLIC_READ', ctx: { ...base, userId: null }, ok: true },
    { permission: 'USER_AUTHENTICATED', ctx: base, ok: true },
    { permission: 'USER_AUTHENTICATED', ctx: { ...base, userId: null }, ok: false },
    { permission: 'USER_INTENT_REQUIRED', ctx: base, ok: true },
    { permission: 'USER_INTENT_REQUIRED', ctx: { ...base, intent: false }, ok: false },
    { permission: 'USER_CONFIRMATION_REQUIRED', ctx: base, ok: true },
    { permission: 'USER_CONFIRMATION_REQUIRED', ctx: { ...base, confirmed: false }, ok: false },
    { permission: 'SYSTEM_ONLY', ctx: base, ok: false },
  ];

  for (const c of cases) {
    it(`${c.permission} with intent=${c.ctx.intent} confirmed=${c.ctx.confirmed} user=${c.ctx.userId !== null} → ${c.ok ? 'allowed' : 'blocked'}`, () => {
      const tool = {
        name: 't',
        description: 't',
        inputSchema: z.object({}),
        aiParameters: { type: 'OBJECT' as const, properties: {} },
        permission: c.permission,
        handler: async () => ({}),
      };
      if (c.ok) {
        expect(() => checkPermission(tool, c.ctx)).not.toThrow();
      } else {
        expect(() => checkPermission(tool, c.ctx)).toThrow();
      }
    });
  }
});

describe('Phase 7 — tool registration', () => {
  it('registers, lists for AI, hides SYSTEM_ONLY, unregisters', () => {
    defineTool({
      name: 'tmp_public_thing',
      description: 'tmp',
      inputSchema: z.object({}),
      aiParameters: { type: 'OBJECT', properties: {} },
      permission: 'PUBLIC_READ',
      handler: async () => ({}),
    });
    defineTool({
      name: 'tmp_system_thing',
      description: 'tmp',
      inputSchema: z.object({}),
      aiParameters: { type: 'OBJECT', properties: {} },
      permission: 'SYSTEM_ONLY',
      handler: async () => ({}),
    });
    try {
      expect(getTool('tmp_public_thing')?.permission).toBe('PUBLIC_READ');
      const names = listToolsForAI().map((t) => t.name);
      expect(names).toContain('tmp_public_thing');
      expect(names).not.toContain('tmp_system_thing');
      expect(names).toContain('get_user_preferences');
      expect(() =>
        defineTool({
          name: 'tmp_public_thing',
          description: 'dup',
          inputSchema: z.object({}),
          aiParameters: { type: 'OBJECT', properties: {} },
          permission: 'PUBLIC_READ',
          handler: async () => ({}),
        }),
      ).toThrow();
    } finally {
      unregisterTool('tmp_public_thing');
      unregisterTool('tmp_system_thing');
    }
    expect(getTool('tmp_public_thing')).toBeUndefined();
  });

  it('declares provider-valid function schemas (ARRAY params require items)', () => {
    // Regression test: the Gemini API rejects function declarations whose
    // ARRAY parameters lack `items`, which broke every chat turn.
    const check = (schema: unknown, path: string): void => {
      const node = schema as Record<string, unknown>;
      if (node['type'] === 'ARRAY') {
        expect(node['items'], `${path} must declare items`).toBeDefined();
        check(node['items'], `${path}.items`);
      }
      const props = node['properties'] as Record<string, unknown> | undefined;
      if (props) {
        for (const [key, value] of Object.entries(props)) check(value, `${path}.${key}`);
      }
    };
    for (const tool of listToolsForAI()) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      check(tool.parameters, tool.name);
    }
  });
});
