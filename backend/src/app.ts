import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { API_PREFIX } from './config/constants.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { requestId } from './middleware/requestId.js';
import { agentRouter } from './modules/agent/agent.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { merchantRouter } from './modules/merchants/merchant.routes.js';
import { orderRouter } from './modules/orders/order.routes.js';
import { paymentRouter } from './modules/payments/payment.routes.js';
import { productRouter } from './modules/products/product.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { webhookRouter } from './modules/webhooks/webhook.routes.js';
import { logger } from './utils/logger.js';
// Side-effect import: registers all agent tools in the tool registry.
import './tools/index.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  // Capture raw bytes for provider webhook signature verification.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(cookieParser());
  app.use(requestId);
  app.use(generalLimiter);

  morgan.token('request-id', (req) => (req as express.Request & { requestId?: string }).requestId ?? '-');
  app.use(
    morgan(':method :url :status :response-time ms - :request-id', {
      stream: {
        write: (line: string) => logger.info(line.trim(), {}),
      },
      skip: () => env.NODE_ENV === 'test',
    }),
  );

  app.use(API_PREFIX, healthRouter);
  app.use(API_PREFIX, authRouter);
  app.use(API_PREFIX, productRouter);
  app.use(API_PREFIX, cartRouter);
  app.use(API_PREFIX, orderRouter);
  app.use(API_PREFIX, paymentRouter);
  app.use(API_PREFIX, webhookRouter);
  app.use(API_PREFIX, agentRouter);
  app.use(API_PREFIX, analyticsRouter);
  app.use(API_PREFIX, merchantRouter);
  app.use(API_PREFIX, usersRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
