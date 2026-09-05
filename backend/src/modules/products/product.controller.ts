import { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../../utils/errors.js';
import { ok } from '../../utils/respond.js';
import { getProductById, listCategories, listProducts, searchProducts } from './product.service.js';
import { productIdSchema } from './product.schemas.js';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listProducts(req.query as never);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function search(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await searchProducts(req.query as never);
    ok(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = productIdSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new ValidationError('Invalid product id');
    }
    const product = await getProductById(parsed.data.id);
    ok(res, { product });
  } catch (err) {
    next(err);
  }
}

export async function categories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await listCategories();
    ok(res, { data });
  } catch (err) {
    next(err);
  }
}
