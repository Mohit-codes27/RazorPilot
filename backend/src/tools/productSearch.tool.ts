import { z } from 'zod';
import { defineTool } from '../agent/toolRegistry.js';
import { searchProducts } from '../modules/products/product.service.js';

const inputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  min_price: z.number().nonnegative().optional(),
  max_price: z.number().nonnegative().optional(),
  category: z.string().trim().min(1).max(255).optional(),
  limit: z.number().int().min(1).max(10).default(5),
});

defineTool({
  name: 'search_products',
  description:
    'Search the product catalog by keywords with optional price/category filters. Returns real catalog products with authoritative prices and stock.',
  inputSchema,
  aiParameters: {
    type: 'OBJECT',
    properties: {
      query: { type: 'STRING', description: 'Keywords, e.g. "wireless headphones"' },
      min_price: { type: 'NUMBER', description: 'Minimum price in INR' },
      max_price: { type: 'NUMBER', description: 'Maximum price in INR' },
      category: { type: 'STRING', description: 'Category slug, e.g. "headphones"' },
      limit: { type: 'INTEGER', description: 'Max results (1-10, default 5)' },
    },
    required: ['query'],
  },
  permission: 'PUBLIC_READ',
  handler: async (args) => {
    const parsed = inputSchema.parse(args);
    return searchProducts({
      q: parsed.query,
      minPrice: parsed.min_price,
      maxPrice: parsed.max_price,
      category: parsed.category,
      sort: 'newest',
      page: 1,
      pageSize: parsed.limit,
    });
  },
});
