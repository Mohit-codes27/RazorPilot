import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateBody } from '../../middleware/validate.js';
import * as controller from './cart.controller.js';
import { addItemSchema, updateItemSchema } from './cart.schemas.js';

export const cartRouter = Router();

// NOTE: requireAuth is applied per-route (not via router.use) so that
// unknown /api/v1/* paths still fall through to the 404 handler.
cartRouter.get('/cart', requireAuth, controller.get);
cartRouter.post('/cart/items', requireAuth, validateBody(addItemSchema), controller.add);
cartRouter.patch('/cart/items/:id', requireAuth, validateBody(updateItemSchema), controller.patch);
cartRouter.delete('/cart/items/:id', requireAuth, controller.remove);
cartRouter.delete('/cart', requireAuth, controller.clear);
