import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { strictLimiter } from '../../middleware/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

export const authRouter = Router();

authRouter.post('/auth/register', strictLimiter, validateBody(registerSchema), controller.register);
authRouter.post('/auth/login', strictLimiter, validateBody(loginSchema), controller.login);
authRouter.post('/auth/logout', controller.logout);
authRouter.get('/auth/me', requireAuth, controller.me);
