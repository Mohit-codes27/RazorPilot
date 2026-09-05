import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { ok } from '../../utils/respond.js';
import { ValidationError } from '../../utils/errors.js';
import { transitionOrder } from '../orders/fulfillment.service.js';
import { listOrdersSchema, orderIdSchema } from '../orders/order.schemas.js';
import {
  createMerchantProduct,
  getMerchantById,
  getMerchantOrder,
  listMerchantOrders,
  listMerchantProducts,
  loginMerchant,
  registerMerchant,
  updateMerchantProduct,
} from './merchant.service.js';
import {
  merchantLoginSchema,
  merchantOrderStatusSchema,
  merchantProductCreateSchema,
  merchantProductUpdateSchema,
  merchantRegisterSchema,
} from './merchant.schemas.js';

const COOKIE_NAME = 'rp_merchant_token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setMerchantCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

export const validateMerchantRegister = validateBody(merchantRegisterSchema);
export const validateMerchantLogin = validateBody(merchantLoginSchema);
export const validateProductCreate = validateBody(merchantProductCreateSchema);
export const validateProductUpdate = validateBody(merchantProductUpdateSchema);
export const validateOrderStatus = validateBody(merchantOrderStatusSchema);
export const validateMerchantOrderList = validateQuery(listOrdersSchema);

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { merchant, token } = await registerMerchant(req.body);
    setMerchantCookie(res, token);
    ok(res, { merchant, token }, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { merchant, token } = await loginMerchant(req.body);
    setMerchantCookie(res, token);
    ok(res, { merchant, token });
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  ok(res, { status: 'ok' });
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, { merchant: await getMerchantById(req.merchant!.id) });
  } catch (err) {
    next(err);
  }
}

export async function products(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, { data: await listMerchantProducts(req.merchant!.id) });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, { product: await createMerchantProduct(req.merchant!.id, req.body) }, 201);
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params = orderIdSchema.safeParse(req.params);
    if (!params.success) throw new ValidationError('Invalid product id');
    ok(res, { product: await updateMerchantProduct(req.merchant!.id, params.data.id, req.body) });
  } catch (err) {
    next(err);
  }
}

export async function orders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listOrdersSchema.parse(req.query);
    ok(res, await listMerchantOrders(req.merchant!.id, parsed));
  } catch (err) {
    next(err);
  }
}

export async function orderDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = orderIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid order id');
    ok(res, { order: await getMerchantOrder(req.merchant!.id, parsed.data.id) });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = orderIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid order id');
    const order = await transitionOrder(
      { type: 'merchant', id: req.merchant!.id },
      parsed.data.id,
      req.body.status,
    );
    ok(res, { order });
  } catch (err) {
    next(err);
  }
}
