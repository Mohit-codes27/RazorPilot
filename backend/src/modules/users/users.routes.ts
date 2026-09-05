import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './users.controller.js';

export const usersRouter = Router();

usersRouter.get('/users/me/preferences', requireAuth, controller.getMyPreferences);
usersRouter.patch(
  '/users/me/preferences',
  requireAuth,
  controller.validateUpdatePreferences,
  controller.patchMyPreferences,
);
