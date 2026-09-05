import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { strictLimiter } from '../../middleware/rateLimit.js';
import * as controller from './payment.controller.js';

export const paymentRouter = Router();

paymentRouter.post(
  '/payments/create',
  strictLimiter,
  requireAuth,
  controller.validateCreatePayment,
  controller.create,
);
paymentRouter.post(
  '/payments/verify',
  strictLimiter,
  requireAuth,
  controller.validateVerifyPayment,
  controller.verify,
);
paymentRouter.get('/payments/:id', requireAuth, controller.getById);
paymentRouter.post('/payments/:id/refund', strictLimiter, requireAuth, controller.refund);
