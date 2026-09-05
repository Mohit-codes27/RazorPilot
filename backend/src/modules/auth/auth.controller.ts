import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { ok } from '../../utils/respond.js';
import { getUserById, loginUser, registerUser } from './auth.service.js';

const COOKIE_NAME = 'rp_token';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await registerUser(req.body);
    setAuthCookie(res, token);
    ok(res, { user, token }, 201);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, token } = await loginUser(req.body);
    setAuthCookie(res, token);
    ok(res, { user, token });
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  ok(res, { status: 'ok' });
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getUserById(req.user!.id);
    ok(res, { user });
  } catch (err) {
    next(err);
  }
}
