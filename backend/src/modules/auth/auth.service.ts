import { prisma } from '../../db/prisma.js';
import { USER_STATUS } from '../../config/constants.js';
import { hashPassword, verifyPassword } from '../../security/password.js';
import { signToken } from '../../security/jwt.js';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from '../../utils/errors.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: Date;
}

function toSafeUser(row: {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: Date;
}): SafeUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export async function registerUser(input: RegisterInput): Promise<{ user: SafeUser; token: string }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      status: USER_STATUS.ACTIVE,
    },
    select: { id: true, name: true, email: true, status: true, createdAt: true },
  });

  const token = signToken(user.id);
  return { user: toSafeUser(user), token };
}

export async function loginUser(input: LoginInput): Promise<{ user: SafeUser; token: string }> {
  const row = await prisma.user.findUnique({ where: { email: input.email } });
  if (!row) {
    throw new AuthenticationError('Invalid email or password');
  }
  if (row.status !== USER_STATUS.ACTIVE) {
    throw new AuthorizationError('Account is suspended');
  }

  const ok = await verifyPassword(input.password, row.passwordHash);
  if (!ok) {
    throw new AuthenticationError('Invalid email or password');
  }

  const token = signToken(row.id);
  return {
    user: toSafeUser(row),
    token,
  };
}

export async function getUserById(userId: string): Promise<SafeUser> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, status: true, createdAt: true },
  });
  if (!row) {
    throw new NotFoundError('User not found');
  }
  return toSafeUser(row);
}
