import { NextFunction, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import { verifyToken } from '../security/jwt.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import { USER_STATUS } from '../config/constants.js';

function extractToken(req: Request): string | null {
  const header = req.header('authorization');
  if (header) {
    const [scheme, token] = header.split(' ');
    if (/^Bearer$/i.test(scheme) && token) {
      return token;
    }
  }
  const cookieToken = (req.cookies as Record<string, unknown> | undefined)?.['rp_token'];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return cookieToken;
  }
  return null;
}

/**
 * Authenticates the request via Bearer token or `rp_token` httpOnly cookie.
 * Loads the user from the database on every request so status changes
 * (e.g. SUSPENDED) take effect immediately. Never trusts a client-supplied id.
 * Merchant tokens are rejected here — merchant routes use requireMerchant.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AuthenticationError('Authentication required');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AuthenticationError('Invalid or expired token');
    }
    if (payload.role === 'merchant') {
      throw new AuthenticationError('Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, status: true },
    });
    if (!user) {
      throw new AuthenticationError('Invalid or expired token');
    }
    if (user.status !== USER_STATUS.ACTIVE) {
      throw new AuthorizationError('Account is suspended');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Merchant authentication. Merchant JWTs carry `role: 'merchant'` and are
 * only accepted on merchant routes; user tokens are rejected here.
 */
export async function requireMerchant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AuthenticationError('Merchant authentication required');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AuthenticationError('Invalid or expired token');
    }
    if (payload.role !== 'merchant') {
      throw new AuthenticationError('Merchant authentication required');
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, status: true },
    });
    if (!merchant) {
      throw new AuthenticationError('Invalid or expired token');
    }
    if (merchant.status !== 'ACTIVE') {
      throw new AuthorizationError('Merchant account is suspended');
    }

    req.merchant = merchant;
    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuth(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
