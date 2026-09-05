import { NextFunction, Request, Response } from 'express';
import { ok } from '../../utils/respond.js';
import {
  getAgentAnalytics,
  getMerchantAnalytics,
  getOrdersAnalytics,
  getOverviewAnalytics,
  getPaymentsAnalytics,
} from './analytics.service.js';

export async function overview(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await getOverviewAnalytics());
  } catch (err) {
    next(err);
  }
}

export async function orders(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await getOrdersAnalytics());
  } catch (err) {
    next(err);
  }
}

export async function payments(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await getPaymentsAnalytics());
  } catch (err) {
    next(err);
  }
}

export async function agent(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await getAgentAnalytics());
  } catch (err) {
    next(err);
  }
}

export async function merchant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await getMerchantAnalytics(req.merchant!.id));
  } catch (err) {
    next(err);
  }
}
