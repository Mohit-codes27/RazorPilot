import { z } from 'zod';
import { defineTool, type ToolContext } from '../agent/toolRegistry.js';
import { addItem, getCart, removeItem } from '../modules/cart/cart.service.js';
import { AuthenticationError } from '../utils/errors.js';
import { ToolExecutionError } from '../utils/errors.js';

function requireUser(ctx: ToolContext): string {
  if (!ctx.userId) throw new AuthenticationError('Sign-in required for this action');
  return ctx.userId;
}

const addSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(999).default(1),
});

defineTool({
  name: 'get_cart',
  description: 'Read the signed-in user current cart with authoritative prices and totals.',
  inputSchema: z.object({}),
  aiParameters: { type: 'OBJECT', properties: {} },
  permission: 'USER_AUTHENTICATED',
  handler: async (_args, ctx) => getCart(requireUser(ctx)),
});

defineTool({
  name: 'add_to_cart',
  description:
    'Add a product to the signed-in user cart. Only call after clear user intent for that product. Prices and stock are validated by the backend.',
  inputSchema: addSchema,
  aiParameters: {
    type: 'OBJECT',
    properties: {
      product_id: { type: 'STRING', description: 'Product UUID' },
      quantity: { type: 'INTEGER', description: 'Quantity (default 1)' },
    },
    required: ['product_id'],
  },
  permission: 'USER_INTENT_REQUIRED',
  handler: async (args, ctx) => {
    const parsed = addSchema.parse(args);
    return addItem(requireUser(ctx), parsed.product_id, parsed.quantity);
  },
});

const removeSchema = z.object({
  product_id: z.string().uuid(),
});

defineTool({
  name: 'remove_from_cart',
  description: 'Remove a product from the signed-in user cart by product id.',
  inputSchema: removeSchema,
  aiParameters: {
    type: 'OBJECT',
    properties: {
      product_id: { type: 'STRING', description: 'Product UUID to remove' },
    },
    required: ['product_id'],
  },
  permission: 'USER_INTENT_REQUIRED',
  handler: async (args, ctx) => {
    const userId = requireUser(ctx);
    const parsed = removeSchema.parse(args);
    const cart = await getCart(userId);
    const item = cart.items.find((i) => i.productId === parsed.product_id);
    if (!item) throw new ToolExecutionError('Product is not in the cart');
    return removeItem(userId, item.id);
  },
});
