import { Response } from 'express';

/**
 * Standard success envelope. Adds `success: true` while preserving all
 * legacy payload keys, so existing consumers keep working. Collection
 * endpoints additionally expose their items under `data`.
 */
export function ok<T extends object>(
  res: Response,
  body: T,
  status = 200,
): void {
  res.status(status).json({ success: true, ...(body as Record<string, unknown>) });
}
