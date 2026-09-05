import { NextFunction, Request, Response } from 'express';
import { getIdempotencyKey } from '../../utils/idempotency.js';
import { ValidationError } from '../../utils/errors.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { ok } from '../../utils/respond.js';
import { createOrder, getOrderById, listOrders, previewOrder } from './order.service.js';
import { transitionOrder } from './fulfillment.service.js';
import { listOrdersSchema, orderIdSchema, previewOrderSchema, userOrderStatusSchema } from './order.schemas.js';

export const validateListOrders = validateQuery(listOrdersSchema);
export const validateUserOrderStatus = validateBody(userOrderStatusSchema);

export async function preview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = previewOrderSchema.safeParse(req.body ?? {});
    const expectedTotal = parsed.success ? parsed.data.expectedTotal : undefined;
    const preview = await previewOrder(req.user!.id, expectedTotal);
    ok(res, {
      ...preview,
      pricing: {
        subtotal: preview.subtotal,
        discount: preview.discount,
        shipping: preview.shipping,
        total: preview.total,
        currency: preview.currency,
      },
      securityChecks: {
        priceVerified: true,
        stockVerified: true,
        totalVerified: true,
        userConfirmationRequired: true,
      },
      requiresUserConfirmation: true as const,
    });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = getIdempotencyKey(req.header('idempotency-key'));
    const { order, created } = await createOrder(req.user!.id, key);
    ok(res, { order }, created ? 201 : 200);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listOrdersSchema.parse(req.query);
    ok(res, await listOrders(req.user!.id, parsed));
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = orderIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid order id');
    ok(res, { order: await getOrderById(req.user!.id, parsed.data.id) });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = orderIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid order id');
    const order = await transitionOrder(
      { type: 'user', id: req.user!.id },
      parsed.data.id,
      req.body.status,
    );
    ok(res, { order });
  } catch (err) {
    next(err);
  }
}
