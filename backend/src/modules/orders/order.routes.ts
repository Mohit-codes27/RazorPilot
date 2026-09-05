import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './order.controller.js';

export const orderRouter = Router();

orderRouter.post('/orders/preview', requireAuth, controller.preview);
orderRouter.post('/orders', requireAuth, controller.create);
orderRouter.get('/orders', requireAuth, controller.validateListOrders, controller.list);
orderRouter.get('/orders/:id', requireAuth, controller.getById);
orderRouter.patch(
  '/orders/:id/status',
  requireAuth,
  controller.validateUserOrderStatus,
  controller.updateStatus,
);
