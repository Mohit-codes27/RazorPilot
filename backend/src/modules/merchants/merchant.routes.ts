import { Router } from 'express';
import { requireMerchant } from '../../middleware/auth.js';
import { strictLimiter } from '../../middleware/rateLimit.js';
import * as controller from './merchant.controller.js';

export const merchantRouter = Router();

merchantRouter.post(
  '/merchants/register',
  strictLimiter,
  controller.validateMerchantRegister,
  controller.register,
);
merchantRouter.post(
  '/merchants/login',
  strictLimiter,
  controller.validateMerchantLogin,
  controller.login,
);
merchantRouter.post('/merchants/logout', controller.logout);
merchantRouter.get('/merchants/me', requireMerchant, controller.me);

merchantRouter.get('/merchants/me/products', requireMerchant, controller.products);
merchantRouter.post(
  '/merchants/me/products',
  requireMerchant,
  controller.validateProductCreate,
  controller.createProduct,
);
merchantRouter.patch(
  '/merchants/me/products/:id',
  requireMerchant,
  controller.validateProductUpdate,
  controller.updateProduct,
);

merchantRouter.get(
  '/merchants/me/orders',
  requireMerchant,
  controller.validateMerchantOrderList,
  controller.orders,
);
merchantRouter.get('/merchants/me/orders/:id', requireMerchant, controller.orderDetail);
merchantRouter.patch(
  '/merchants/me/orders/:id/status',
  requireMerchant,
  controller.validateOrderStatus,
  controller.updateOrderStatus,
);
