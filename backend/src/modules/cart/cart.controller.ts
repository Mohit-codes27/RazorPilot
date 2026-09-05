import { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../../utils/errors.js';
import { ok } from '../../utils/respond.js';
import { addItem, clearCart, getCart, removeItem, updateItem } from './cart.service.js';
import { cartItemIdSchema } from './cart.schemas.js';

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, { cart: await getCart(req.user!.id) });
  } catch (err) {
    next(err);
  }
}

export async function add(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cart = await addItem(req.user!.id, req.body.productId, req.body.quantity);
    ok(res, { cart });
  } catch (err) {
    next(err);
  }
}

export async function patch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = cartItemIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid cart item id');
    const cart = await updateItem(req.user!.id, parsed.data.id, req.body.quantity);
    ok(res, { cart });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = cartItemIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid cart item id');
    const cart = await removeItem(req.user!.id, parsed.data.id);
    ok(res, { cart });
  } catch (err) {
    next(err);
  }
}

export async function clear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cart = await clearCart(req.user!.id);
    ok(res, { cart });
  } catch (err) {
    next(err);
  }
}
