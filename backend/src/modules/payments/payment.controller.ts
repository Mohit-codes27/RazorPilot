import { NextFunction, Request, Response } from 'express';
import { getIdempotencyKey } from '../../utils/idempotency.js';
import { ValidationError } from '../../utils/errors.js';
import { ok } from '../../utils/respond.js';
import { getOrderById } from '../orders/order.service.js';
import { createPayment, getPayment, refundPayment, verifyPayment } from './payment.service.js';
import { createPaymentSchema, paymentIdSchema, verifyPaymentSchema } from './payment.schemas.js';
import { validateBody } from '../../middleware/validate.js';

export const validateCreatePayment = validateBody(createPaymentSchema);
export const validateVerifyPayment = validateBody(verifyPaymentSchema);

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = getIdempotencyKey(req.header('idempotency-key'));
    const { payment, checkout, created } = await createPayment(req.user!.id, req.body.orderId, key);
    ok(res, { payment, checkout }, created ? 201 : 200);
  } catch (err) {
    next(err);
  }
}

export async function verify(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await verifyPayment(req.user!.id, req.body);
    const order = await getOrderById(req.user!.id, result.payment.orderId);
    ok(res, {
      ...result,
      success: result.verified,
      order,
      status: result.orderStatus as 'PAID' | 'FAILED' | 'PENDING',
      message: result.verified
        ? 'Payment verified. Order confirmed.'
        : 'Payment verification failed. No money was captured.',
    });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = paymentIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid payment id');
    ok(res, { payment: await getPayment(req.user!.id, parsed.data.id) });
  } catch (err) {
    next(err);
  }
}

export async function refund(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = paymentIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid payment id');
    ok(res, await refundPayment(req.user!.id, parsed.data.id));
  } catch (err) {
    next(err);
  }
}
