import { prisma } from '../../db/prisma.js';
import { hashPassword, verifyPassword } from '../../security/password.js';
import { signToken } from '../../security/jwt.js';
import { getOrderById as getUserOrderById } from '../orders/order.service.js';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js';
import type { MerchantLoginInput, MerchantRegisterInput } from './merchant.schemas.js';

export interface SafeMerchant {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: Date;
}

const safeSelect = { id: true, name: true, email: true, status: true, createdAt: true } as const;

export async function registerMerchant(
  input: MerchantRegisterInput,
): Promise<{ merchant: SafeMerchant; token: string }> {
  const existing = await prisma.merchant.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('Email already registered');
  const merchant = await prisma.merchant.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      status: 'ACTIVE',
    },
    select: safeSelect,
  });
  return { merchant, token: signToken(merchant.id, 'merchant') };
}

export async function loginMerchant(
  input: MerchantLoginInput,
): Promise<{ merchant: SafeMerchant; token: string }> {
  const row = await prisma.merchant.findUnique({ where: { email: input.email } });
  if (!row || !row.passwordHash) throw new AuthenticationError('Invalid email or password');
  if (row.status !== 'ACTIVE') throw new AuthorizationError('Merchant account is suspended');
  if (!(await verifyPassword(input.password, row.passwordHash))) {
    throw new AuthenticationError('Invalid email or password');
  }
  const { passwordHash: _ph, ...safe } = row;
  void _ph;
  return {
    merchant: { id: safe.id, name: safe.name, email: safe.email, status: safe.status, createdAt: safe.createdAt },
    token: signToken(row.id, 'merchant'),
  };
}

export async function getMerchantById(merchantId: string): Promise<SafeMerchant> {
  const row = await prisma.merchant.findUnique({ where: { id: merchantId }, select: safeSelect });
  if (!row) throw new NotFoundError('Merchant not found');
  return row;
}

function slugify(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${Date.now().toString(36)}`;
}

export async function createMerchantProduct(
  merchantId: string,
  input: {
    name: string;
    description?: string;
    categoryId?: string;
    price: number;
    currency?: string;
    stockQuantity?: number;
    status?: 'ACTIVE' | 'OUT_OF_STOCK' | 'INACTIVE';
    attributes?: Record<string, unknown>;
    imageUrl?: string;
  },
) {
  if (input.categoryId) {
    const category = await prisma.productCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new ValidationError('Invalid category id');
  }
  return prisma.product.create({
    data: {
      merchantId,
      categoryId: input.categoryId,
      name: input.name,
      slug: slugify(input.name),
      description: input.description ?? '',
      price: input.price,
      currency: input.currency ?? 'INR',
      stockQuantity: input.stockQuantity ?? 0,
      status: input.status ?? 'ACTIVE',
      attributes: (input.attributes ?? {}) as never,
      imageUrl: input.imageUrl,
    },
  });
}

export async function updateMerchantProduct(
  merchantId: string,
  productId: string,
  input: {
    name?: string;
    description?: string;
    categoryId?: string | null;
    price?: number;
    stockQuantity?: number;
    status?: 'ACTIVE' | 'OUT_OF_STOCK' | 'INACTIVE';
    attributes?: Record<string, unknown>;
    imageUrl?: string | null;
  },
) {
  const existing = await prisma.product.findFirst({ where: { id: productId, merchantId } });
  if (!existing) throw new NotFoundError('Product not found');
  if (input.categoryId) {
    const category = await prisma.productCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new ValidationError('Invalid category id');
  }
  return prisma.product.update({
    where: { id: productId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.attributes !== undefined ? { attributes: input.attributes as never } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    },
  });
}

export async function listMerchantProducts(merchantId: string) {
  return prisma.product.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function listMerchantOrders(
  merchantId: string,
  options: { page: number; pageSize: number; status?: string },
) {
  const where: { merchantId: string; status?: string } = { merchantId };
  if (options.status) where.status = options.status;
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        items: { select: { productName: true, quantity: true, totalPrice: true } },
      },
    }),
  ]);
  return {
    data: rows.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      status: r.status,
      itemCount: r.items.reduce((n, i) => n + i.quantity, 0),
      total: Number(r.totalAmount),
      currency: r.currency,
      createdAt: r.createdAt,
      items: r.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        totalPrice: Number(i.totalPrice),
      })),
    })),
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / options.pageSize),
    },
  };
}

/** Merchant order detail — reuses the full order DTO (includes timeline). */
export async function getMerchantOrder(merchantId: string, orderId: string) {
  const probe = await prisma.order.findFirst({
    where: { id: orderId, merchantId },
    select: { id: true, userId: true },
  });
  if (!probe) throw new NotFoundError('Order not found');
  return getUserOrderById(probe.userId, orderId);
}
