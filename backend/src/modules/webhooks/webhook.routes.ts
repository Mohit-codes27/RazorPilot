import { Router } from 'express';
import { strictLimiter } from '../../middleware/rateLimit.js';
import * as controller from './webhook.controller.js';

export const webhookRouter = Router();

webhookRouter.post('/webhooks/razorpay', strictLimiter, controller.razorpayWebhook);
