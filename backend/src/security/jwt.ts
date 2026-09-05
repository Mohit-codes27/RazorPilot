import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type TokenRole = 'user' | 'merchant';

export interface JwtPayload {
  sub: string;
  role: TokenRole;
  iat?: number;
  exp?: number;
}

export function signToken(userId: string, role: TokenRole = 'user'): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as unknown as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
