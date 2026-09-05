import { z } from 'zod';
import { defineTool, type ToolContext } from '../agent/toolRegistry.js';
import { createOrder, getOrderById, previewOrder } from '../modules/orders/order.service.js';
import { createPayment } from '../modules/payments/payment.service.js';
import { AuthenticationError } from '../utils/errors.js';

function requireUser(ctx: ToolContext): string {
  if (!ctx.userId) throw new AuthenticationError('Sign-in required for this action');
  return ctx.userId;
}

defineTool({
  name: 'preview_order',
  description:
    'Calculate the authoritative order total for the user current cart from live database prices. Never quote prices from memory — always use this.',
  inputSchema: z.object({}),
  aiParameters: { type: 'OBJECT', properties: {} },
  permission: 'USER_AUTHENTICATED',
  handler: async (_args, ctx) => previewOrder(requireUser(ctx)),
});

defineTool({
  name: 'create_order',
  description:
    'Create a PENDING_PAYMENT order from the user cart with authoritative pricing and stock reservation. Only call after clear purchase intent.',
  inputSchema: z.object({}),
  aiParameters: { type: 'OBJECT', properties: {} },
  permission: 'USER_INTENT_REQUIRED',
  handler: async (_args, ctx) => {
    const { order } = await createOrder(requireUser(ctx), null);
    return order;
  },
});

const prepareSchema = z.object({
  order_id: z.string().uuid().optional(),
});

defineTool({
  name: 'prepare_payment',
  description:
    'Prepare Razorpay checkout for an order (creates the order from the cart when order_id is omitted). Returns checkout data for the user to confirm and pay. Requires explicit user confirmation.',
  inputSchema: prepareSchema,
  aiParameters: {
    type: 'OBJECT',
    properties: {
      order_id: { type: 'STRING', description: 'Existing order UUID; omit to order the current cart' },
    },
  },
  permission: 'USER_CONFIRMATION_REQUIRED',
  handler: async (args, ctx) => {
    const userId = requireUser(ctx);
    const parsed = prepareSchema.parse(args);
    const order = parsed.order_id
      ? await getOrderById(userId, parsed.order_id)
      : (await createOrder(userId, null)).order;
    const { payment, checkout } = await createPayment(
      userId,
      order.id,
      `agent-${ctx.sessionId}-${order.id}`,
    );
    return { order, payment, checkout };
  },
});
