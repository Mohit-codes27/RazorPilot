import { Router, Request, Response } from 'express';
import { checkDbConnection } from '../../db/prisma.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy' });
});

healthRouter.get('/health/db', async (_req: Request, res: Response) => {
  try {
    await checkDbConnection();
    res.json({ status: 'healthy', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});
