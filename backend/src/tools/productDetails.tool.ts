import { z } from 'zod';
import { defineTool } from '../agent/toolRegistry.js';
import { getProductById } from '../modules/products/product.service.js';

const inputSchema = z.object({
  product_id: z.string().uuid(),
});

defineTool({
  name: 'get_product',
  description: 'Fetch authoritative details for one product by id: price, stock, attributes, merchant.',
  inputSchema,
  aiParameters: {
    type: 'OBJECT',
    properties: {
      product_id: { type: 'STRING', description: 'Product UUID from search results' },
    },
    required: ['product_id'],
  },
  permission: 'PUBLIC_READ',
  handler: async (args) => getProductById(inputSchema.parse(args).product_id),
});
