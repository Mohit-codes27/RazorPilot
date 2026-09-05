import { z } from 'zod';

export const merchantRegisterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  email: z.string().trim().toLowerCase().email('Invalid email').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const merchantLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email').max(255),
  password: z.string().min(1, 'Password is required').max(128),
});

export const merchantProductCreateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional().default(''),
  categoryId: z.string().uuid('Invalid category id').optional(),
  price: z.number().positive().max(10000000),
  currency: z.string().trim().min(1).max(10).optional().default('INR'),
  stockQuantity: z.number().int().min(0).max(1000000).default(0),
  status: z.enum(['ACTIVE', 'OUT_OF_STOCK', 'INACTIVE']).optional().default('ACTIVE'),
  attributes: z.record(z.unknown()).optional().default({}),
  imageUrl: z.string().trim().max(2000).optional(),
});

export const merchantProductUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(5000).optional(),
    categoryId: z.string().uuid('Invalid category id').nullable().optional(),
    price: z.number().positive().max(10000000).optional(),
    stockQuantity: z.number().int().min(0).max(1000000).optional(),
    status: z.enum(['ACTIVE', 'OUT_OF_STOCK', 'INACTIVE']).optional(),
    attributes: z.record(z.unknown()).optional(),
    imageUrl: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const merchantOrderStatusSchema = z.object({
  status: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
});

export type MerchantRegisterInput = z.infer<typeof merchantRegisterSchema>;
export type MerchantLoginInput = z.infer<typeof merchantLoginSchema>;
