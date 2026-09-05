import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { NotFoundError } from '../../utils/errors.js';
import type { SafeUser } from '../auth/auth.service.js';

const safeSelect = { id: true, name: true, email: true, status: true, createdAt: true } as const;

export async function findUserById(userId: string): Promise<SafeUser> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: safeSelect });
  if (!row) {
    throw new NotFoundError('User not found');
  }
  return row;
}

export const updatePreferencesSchema = z
  .object({
    preferredCurrency: z.string().trim().min(1).max(10).optional(),
    maxBudget: z.number().nonnegative().max(100000000).nullable().optional(),
    preferredPaymentMethod: z.string().trim().min(1).max(50).nullable().optional(),
    preferences: z.record(z.unknown()).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export interface UserPreferencesDTO {
  preferredCurrency: string | null;
  maxBudget: number | null;
  preferredPaymentMethod: string | null;
  preferences: unknown;
}

export async function getPreferences(userId: string): Promise<UserPreferencesDTO> {
  const row = await prisma.userPreference.findUnique({ where: { userId } });
  return {
    preferredCurrency: row?.preferredCurrency ?? null,
    maxBudget: row?.maxBudget !== null && row?.maxBudget !== undefined ? Number(row.maxBudget) : null,
    preferredPaymentMethod: row?.preferredPaymentMethod ?? null,
    preferences: row?.preferences ?? null,
  };
}

export async function updatePreferences(
  userId: string,
  input: UpdatePreferencesInput,
): Promise<UserPreferencesDTO> {
  await prisma.user.findUniqueOrThrow({ where: { id: userId } }).catch(() => {
    throw new NotFoundError('User not found');
  });
  const row = await prisma.userPreference.upsert({
    where: { userId },
    update: {
      ...(input.preferredCurrency !== undefined ? { preferredCurrency: input.preferredCurrency } : {}),
      ...(input.maxBudget !== undefined ? { maxBudget: input.maxBudget } : {}),
      ...(input.preferredPaymentMethod !== undefined
        ? { preferredPaymentMethod: input.preferredPaymentMethod }
        : {}),
      ...(input.preferences !== undefined
        ? { preferences: (input.preferences ?? {}) as never }
        : {}),
    },
    create: {
      userId,
      preferredCurrency: input.preferredCurrency,
      maxBudget: input.maxBudget ?? undefined,
      preferredPaymentMethod: input.preferredPaymentMethod ?? undefined,
      preferences: ((input.preferences ?? {}) as never),
    },
  });
  return {
    preferredCurrency: row.preferredCurrency,
    maxBudget: row.maxBudget !== null ? Number(row.maxBudget) : null,
    preferredPaymentMethod: row.preferredPaymentMethod,
    preferences: row.preferences,
  };
}
