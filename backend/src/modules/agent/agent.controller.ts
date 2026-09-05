import { NextFunction, Request, Response } from 'express';
import { createSession, getActivity, getSession, listMessages, listSessions, postMessage } from '../../agent/orchestrator.js';
import { ValidationError } from '../../utils/errors.js';
import { ok } from '../../utils/respond.js';
import { sessionIdSchema } from '../../agent/schemas.js';

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await createSession(req.user!.id, req.body.context);
    ok(res, { session }, 201);
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = sessionIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid session id');
    ok(res, await getSession(req.user!.id, parsed.data.id));
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    ok(res, await listSessions(req.user!.id));
  } catch (err) {
    next(err);
  }
}

export async function messages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = sessionIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid session id');
    ok(res, await listMessages(req.user!.id, parsed.data.id));
  } catch (err) {
    next(err);
  }
}

export async function activity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = sessionIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid session id');
    ok(res, await getActivity(req.user!.id, parsed.data.id));
  } catch (err) {
    next(err);
  }
}

export async function message(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = sessionIdSchema.safeParse(req.params);
    if (!parsed.success) throw new ValidationError('Invalid session id');
    const result = await postMessage(
      req.user!.id,
      parsed.data.id,
      req.body.message,
      req.body.confirmed === true,
    );
    ok(res, result);
  } catch (err) {
    next(err);
  }
}
