import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id =
    typeof incoming === 'string' && incoming.trim().length > 0 ? incoming : `req_${randomUUID()}`;
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
