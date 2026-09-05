import { z } from 'zod';
import { PAGINATION } from '../../config/constants.js';

export const orderIdSchema = z.object({
  id: z.string().uuid('Invalid order id'),
});

export const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
  status: z.string().trim().min(1).max(50).optional(),
});

export const userOrderStatusSchema = z.object({
  status: z.enum(['CANCELLED']),
});

export const previewOrderSchema = z.object({
  expectedTotal: z.coerce.number().nonnegative().optional(),
});

export type ListOrdersInput = z.infer<typeof listOrdersSchema>;
