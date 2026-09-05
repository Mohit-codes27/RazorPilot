import { z } from 'zod';

export const createPaymentSchema = z.object({
  orderId: z.string().uuid('Invalid order id'),
});

export const verifyPaymentSchema = z.object({
  providerOrderId: z.string().min(1, 'Provider order id is required').max(255),
  providerPaymentId: z.string().min(1, 'Provider payment id is required').max(255),
  signature: z.string().min(1, 'Signature is required').max(1024),
});

export const paymentIdSchema = z.object({
  id: z.string().uuid('Invalid payment id'),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
