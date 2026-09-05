import { Router } from 'express';
import { createSessionSchema, postMessageSchema } from '../../agent/schemas.js';
import { requireAuth } from '../../middleware/auth.js';
import { strictLimiter } from '../../middleware/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';
import * as controller from './agent.controller.js';

export const agentRouter = Router();

agentRouter.post(
  '/agent/sessions',
  strictLimiter,
  requireAuth,
  validateBody(createSessionSchema),
  controller.create,
);
agentRouter.get('/agent/sessions', requireAuth, controller.list);
agentRouter.get('/agent/sessions/:id', requireAuth, controller.get);
agentRouter.get('/agent/sessions/:id/messages', requireAuth, controller.messages);
agentRouter.get('/agent/sessions/:id/activity', requireAuth, controller.activity);
agentRouter.post(
  '/agent/sessions/:id/messages',
  strictLimiter,
  requireAuth,
  validateBody(postMessageSchema),
  controller.message,
);
