import { Router } from 'express';
import { validateQuery } from '../../middleware/validate.js';
import * as controller from './product.controller.js';
import { listProductsSchema, searchProductsSchema } from './product.schemas.js';

export const productRouter = Router();

// NOTE: /products/search must be registered before /products/:id.
productRouter.get('/products/search', validateQuery(searchProductsSchema), controller.search);
productRouter.get('/products', validateQuery(listProductsSchema), controller.list);
productRouter.get('/products/:id', controller.getById);
productRouter.get('/categories', controller.categories);
