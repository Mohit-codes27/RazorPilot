import { z } from 'zod';

export const MAX_ITEM_QUANTITY = 999;

export const addItemSchema = z.object({
  productId: z.string().uuid('Invalid product id'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(MAX_ITEM_QUANTITY).default(1),
});

export const updateItemSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(MAX_ITEM_QUANTITY),
});

export const cartItemIdSchema = z.object({
  id: z.string().uuid('Invalid cart item id'),
});

export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
