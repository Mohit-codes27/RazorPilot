import { NextFunction, Request, Response } from 'express';
import { validateBody } from '../../middleware/validate.js';
import { ok } from '../../utils/respond.js';
import { getPreferences, updatePreferences, updatePreferencesSchema } from './users.service.js';

export const validateUpdatePreferences = validateBody(updatePreferencesSchema);

export async function getMyPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, { preferences: await getPreferences(req.user!.id) });
  } catch (err) {
    next(err);
  }
}

export async function patchMyPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, { preferences: await updatePreferences(req.user!.id, req.body) });
  } catch (err) {
    next(err);
  }
}
