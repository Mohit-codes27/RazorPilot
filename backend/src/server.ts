import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`RazorPilot backend listening`, {
    route: `:${env.PORT}`,
    status: env.NODE_ENV,
  });
});

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down`, {});
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
