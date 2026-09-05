import { z } from 'zod';
import { defineTool } from '../agent/toolRegistry.js';
import { getProductById } from '../modules/products/product.service.js';

const inputSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(2).max(5),
  criteria: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
});

defineTool({
  name: 'compare_products',
  description:
    'Side-by-side normalized comparison of 2-5 products. Returns authoritative fields for each id plus any ids that could not be resolved.',
  inputSchema,
  aiParameters: {
    type: 'OBJECT',
    properties: {
      product_ids: {
        type: 'ARRAY',
        description: '2-5 product UUIDs to compare',
        items: { type: 'STRING' },
      },
      criteria: {
        type: 'ARRAY',
        description: 'Aspects the user cares about, e.g. ["battery","comfort"]',
        items: { type: 'STRING' },
      },
    },
    required: ['product_ids'],
  },
  permission: 'PUBLIC_READ',
  handler: async (args) => {
    const parsed = inputSchema.parse(args);
    const products = [];
    const missing: string[] = [];
    for (const id of new Set(parsed.product_ids)) {
      try {
        const p = await getProductById(id);
        products.push({
          id: p.id,
          name: p.name,
          price: p.price,
          currency: p.currency,
          stock: p.stockQuantity,
          status: p.status,
          category: p.category?.slug ?? null,
          merchant: p.merchant.name,
          attributes: p.attributes,
        });
      } catch {
        missing.push(id);
      }
    }
    return { products, missing, criteria: parsed.criteria ?? [] };
  },
});
