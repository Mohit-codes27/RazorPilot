import { z } from 'zod';
import { defineTool, type ToolContext } from '../agent/toolRegistry.js';
import { prisma } from '../db/prisma.js';

const inputSchema = z.object({});

async function handler(_args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  if (!ctx.userId) return { configured: false };
  const pref = await prisma.userPreference.findUnique({ where: { userId: ctx.userId } });
  if (!pref) return { configured: false };
  return {
    configured: true,
    preferred_currency: pref.preferredCurrency,
    max_budget: pref.maxBudget !== null ? Number(pref.maxBudget) : null,
    preferred_payment_method: pref.preferredPaymentMethod,
    preferences: pref.preferences,
  };
}

defineTool({
  name: 'get_user_preferences',
  description: 'Read the signed-in shopping preferences (budget, currency, preferred features). Takes no arguments.',
  inputSchema,
  aiParameters: { type: 'OBJECT', properties: {} },
  permission: 'USER_AUTHENTICATED',
  handler,
});
