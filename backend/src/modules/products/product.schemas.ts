import { z } from 'zod';
import { PAGINATION } from '../../config/constants.js';

const filters = {
  category: z.string().trim().min(1).max(255).optional(),
  merchant: z.string().uuid('Invalid merchant id').optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  availability: z.enum(['in_stock', 'out_of_stock']).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional().default('newest'),
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
};

export const listProductsSchema = z.object(filters);

export const searchProductsSchema = z.object({
  ...filters,
  q: z.string().trim().min(1, 'Search query is required').max(200),
});

export const productIdSchema = z.object({
  id: z.string().uuid('Invalid product id'),
});

export type ListProductsInput = z.infer<typeof listProductsSchema>;
export type SearchProductsInput = z.infer<typeof searchProductsSchema>;
