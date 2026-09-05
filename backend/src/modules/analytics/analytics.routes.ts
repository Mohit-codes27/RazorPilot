import { Router } from 'express';
import { requireAuth, requireMerchant } from '../../middleware/auth.js';
import * as controller from './analytics.controller.js';

export const analyticsRouter = Router();

analyticsRouter.get('/analytics/overview', requireAuth, controller.overview);
analyticsRouter.get('/analytics/orders', requireAuth, controller.orders);
analyticsRouter.get('/analytics/payments', requireAuth, controller.payments);
analyticsRouter.get('/analytics/agent', requireAuth, controller.agent);
analyticsRouter.get('/analytics/merchant', requireMerchant, controller.merchant);
