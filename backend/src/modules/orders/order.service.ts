import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { ORDER_STATUS, PRODUCT_STATUS } from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';
import { CartEmptyError, ConflictError, NotFoundError, PriceChangedError, ProductOutOfStockError } from '../../utils/errors.js';

/** Free shipping at or above this subtotal (INR); flat fee below it. */
export const FREE_SHIPPING_THRESHOLD = 500;
export const SHIPPING_FLAT_FEE = 49;

export function computeShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_FEE;
}

export function generateOrderNumber(): string {
  return `RP-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

const orderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  subtotal: true,
  shippingAmount: true,
  discountAmount: true,
  totalAmount: true,
  currency: true,
  merchantId: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { createdAt: 'asc' } as const,
    select: {
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      product: { select: { imageUrl: true } },
    },
  },
  payments: {
    orderBy: { createdAt: 'asc' } as const,
    select: { id: true, provider: true, status: true, amount: true, currency: true, createdAt: true, updatedAt: true },
  },
} as const;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

export interface OrderItemDTO {
  id: string;
  productId: string | null;
  productName: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderTimelineItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: 'completed' | 'current' | 'pending';
  timestamp: string;
}

export interface OrderDTO {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  pricing: {
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    currency: string;
  };
  currency: string;
  merchantId: string | null;
  items: OrderItemDTO[];
  payments: { id: string; provider: string; status: string; amount: number; currency: string }[];
  payment?: { status: 'CREATED' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'; provider: 'razorpay' | 'simulator' };
  timeline: OrderTimelineItem[];
  createdAt: Date;
  updatedAt: Date;
}

function toOrderDTO(row: OrderRow): OrderDTO {
  const subtotal = Number(row.subtotal);
  const shipping = Number(row.shippingAmount);
  const discount = Number(row.discountAmount);
  const total = Number(row.totalAmount);
  const lastPayment = row.payments[row.payments.length - 1];
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    subtotal,
    shipping,
    discount,
    total,
    pricing: { subtotal, discount, shipping, total, currency: row.currency },
    currency: row.currency,
    merchantId: row.merchantId,
    items: row.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      imageUrl: i.product?.imageUrl ?? null,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
    })),
    payments: row.payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      status: p.status,
      amount: Number(p.amount),
      currency: p.currency,
    })),
    payment: lastPayment
      ? {
          status: mapPaymentSummaryStatus(lastPayment.status),
          provider: (lastPayment.provider === 'razorpay' ? 'razorpay' : 'simulator') as
            | 'razorpay'
            | 'simulator',
        }
      : undefined,
    timeline: buildTimeline(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPaymentSummaryStatus(status: string): 'CREATED' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' {
  switch (status) {
    case 'CAPTURED':
      return 'PAID';
    case 'FAILED':
      return 'FAILED';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'AUTHORIZED':
      return 'PENDING';
    default:
      return 'CREATED';
  }
}

/**
 * Frontend-safe order timeline derived from persisted order + payment rows.
 * The frontend must not hardcode progress — it renders this list.
 */
function buildTimeline(row: OrderRow): OrderTimelineItem[] {
  const iso = (d: Date) => d.toISOString();
  const firstPayment = row.payments[0];
  const lastPayment = row.payments[row.payments.length - 1];
  const paid = row.status === ORDER_STATUS.PAID;
  const failed = row.status === ORDER_STATUS.PAYMENT_FAILED;
  const cancelled = row.status === ORDER_STATUS.CANCELLED;
  // Fulfillment stage index: reached stages are completed, the next is current.
  const stageIndex: Record<string, number> = { PROCESSING: 0, SHIPPED: 1, DELIVERED: 2 };
  const stage = stageIndex[row.status] ?? -1;
  const settled = paid || stage >= 0;
  const stageStatus = (i: number): 'completed' | 'current' | 'pending' => {
    if (!settled && stage < 0) return 'pending';
    if (stage < 0) return i === 0 ? 'current' : 'pending';
    if (i < stage) return 'completed';
    if (i === stage) return 'completed';
    return i === stage + 1 ? 'current' : 'pending';
  };

  const events: OrderTimelineItem[] = [
    {
      id: `${row.id}-created`,
      type: 'ORDER_CREATED',
      title: 'Order created',
      status: 'completed',
      timestamp: iso(row.createdAt),
    },
    {
      id: `${row.id}-initiated`,
      type: 'PAYMENT_INITIATED',
      title: 'Payment initiated',
      status: firstPayment ? 'completed' : settled || failed ? 'completed' : 'pending',
      timestamp: iso(firstPayment ? firstPayment.createdAt : row.createdAt),
    },
  ];

  if (failed || cancelled) {
    events.push({
      id: `${row.id}-failed`,
      type: failed ? 'PAYMENT_FAILED' : 'CANCELLED',
      title: failed ? 'Payment failed' : 'Order cancelled',
      status: 'completed',
      timestamp: iso(lastPayment ? lastPayment.updatedAt : row.updatedAt),
    });
    return events;
  }

  events.push(
    {
      id: `${row.id}-verified`,
      type: 'PAYMENT_VERIFIED',
      title: 'Payment verified',
      status: settled ? 'completed' : 'pending',
      timestamp: iso(lastPayment && settled ? lastPayment.updatedAt : row.updatedAt),
    },
    {
      id: `${row.id}-confirmed`,
      type: 'ORDER_CONFIRMED',
      title: 'Order confirmed',
      status: settled ? 'completed' : 'current',
      timestamp: iso(row.updatedAt),
    },
    {
      id: `${row.id}-processing`,
      type: 'PROCESSING',
      title: 'Processing',
      status: stageStatus(0),
      timestamp: iso(row.updatedAt),
    },
    { id: `${row.id}-shipped`, type: 'SHIPPED', title: 'Shipped', status: stageStatus(1), timestamp: iso(row.updatedAt) },
    { id: `${row.id}-delivered`, type: 'DELIVERED', title: 'Delivered', status: stageStatus(2), timestamp: iso(row.updatedAt) },
  );
  return events;
}

export interface PreviewItem {
  productId: string;
  productName: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  stockVerified: boolean;
}

export interface OrderPreview {
  items: PreviewItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
}

interface PricedLine {
  productId: string;
  productName: string;
  imageUrl?: string | null;
  merchantId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/**
 * Loads the user's ACTIVE cart and prices every line from current DB prices.
 * Never trusts cart snapshots, frontend totals, or AI-provided prices.
 */
async function priceActiveCart(userId: string): Promise<{ cartId: string; lines: PricedLine[] }> {
  const cart = await prisma.cart.findFirst({
    where: { userId, status: 'ACTIVE' },
    select: {
      id: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          product: { select: { id: true, name: true, merchantId: true, price: true, status: true, stockQuantity: true, imageUrl: true } },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new CartEmptyError();
  }

  const lines: PricedLine[] = [];
  for (const item of cart.items) {
    const p = item.product;
    if (!p || p.status === PRODUCT_STATUS.INACTIVE) {
      throw new NotFoundError(`Product no longer available: ${item.productId}`);
    }
    if (p.status !== PRODUCT_STATUS.ACTIVE) {
      throw new ProductOutOfStockError(`Product is not available for purchase: ${p.name}`);
    }
    if (item.quantity > p.stockQuantity) {
      throw new ProductOutOfStockError(`Insufficient stock for ${p.name}: only ${p.stockQuantity} available`);
    }
    const unitPrice = Number(p.price);
    lines.push({
      productId: p.id,
      productName: p.name,
      imageUrl: p.imageUrl,
      merchantId: p.merchantId,
      quantity: item.quantity,
      unitPrice,
      totalPrice: unitPrice * item.quantity,
    });
  }
  return { cartId: cart.id, lines };
}

function summarize(lines: PricedLine[]): OrderPreview {
  const subtotal = lines.reduce((n, l) => n + l.totalPrice, 0);
  const shipping = computeShipping(subtotal);
  const discount = 0;
  return {
    items: lines.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      imageUrl: l.imageUrl,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      totalPrice: l.totalPrice,
      stockVerified: true,
    })),
    subtotal,
    shipping,
    discount,
    total: subtotal + shipping - discount,
    currency: 'INR',
  };
}

export async function previewOrder(userId: string, expectedTotal?: number): Promise<OrderPreview> {
  const { lines } = await priceActiveCart(userId);
  const preview = summarize(lines);
  if (expectedTotal !== undefined && Number(expectedTotal) !== preview.total) {
    throw new PriceChangedError(
      'The price has changed. Please review the updated order total.',
      { preview },
    );
  }
  return preview;
}

export async function createOrder(userId: string, idempotencyKey: string | null): Promise<{ order: OrderDTO; created: boolean }> {
  if (idempotencyKey) {
    const existing = await prisma.order.findFirst({
      where: { userId, idempotencyKey },
      select: orderSelect,
    });
    if (existing) return { order: toOrderDTO(existing), created: false };
  }

  const { cartId, lines } = await priceActiveCart(userId);
  const preview = summarize(lines);
  const merchantIds = [...new Set(lines.map((l) => l.merchantId))];

  const order = await prisma.$transaction(async (tx) => {
    // Atomic stock decrement; zero updated rows means a race lost → abort.
    for (const line of lines) {
      const res = await tx.product.updateMany({
        where: { id: line.productId, stockQuantity: { gte: line.quantity } },
        data: { stockQuantity: { decrement: line.quantity } },
      });
      if (res.count === 0) {
        throw new ConflictError(`Insufficient stock for ${line.productName}`);
      }
    }

    const created = await tx.order.create({
      data: {
        userId,
        merchantId: merchantIds.length === 1 ? merchantIds[0] : null,
        orderNumber: generateOrderNumber(),
        status: ORDER_STATUS.PENDING_PAYMENT,
        subtotal: preview.subtotal,
        shippingAmount: preview.shipping,
        discountAmount: preview.discount,
        totalAmount: preview.total,
        currency: preview.currency,
        idempotencyKey,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            totalPrice: l.totalPrice,
          })),
        },
      },
      select: orderSelect,
    });

    await tx.cart.update({
      where: { id: cartId },
      data: { status: 'CHECKED_OUT' },
    });

    await tx.auditLog.create({
      data: {
        userId,
        entityType: 'ORDER',
        entityId: created.id,
        action: 'ORDER_CREATED',
        actorType: 'USER',
        metadata: { orderNumber: created.orderNumber, total: preview.total },
      },
    });

    return created;
  });

  return { order: toOrderDTO(order), created: true };
}

export interface OrderListOptions {
  page: number;
  pageSize: number;
  status?: string;
}

export interface OrderListItemDTO {
  id: string;
  orderNumber: string;
  status: string;
  itemCount: number;
  total: number;
  currency: string;
  previewImageUrl: string | null;
  createdAt: Date;
}

export async function listOrders(
  userId: string,
  options: OrderListOptions,
): Promise<{
  data: OrderListItemDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const where: { userId: string; status?: string } = { userId };
  if (options.status) where.status = options.status;
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: orderSelect,
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
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
      previewImageUrl: r.items[0]?.product?.imageUrl ?? null,
      createdAt: r.createdAt,
    })),
    pagination: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / options.pageSize),
    },
  };
}

export async function getOrderById(userId: string, orderId: string): Promise<OrderDTO> {
  const row = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: orderSelect,
  });
  if (!row) throw new NotFoundError('Order not found');
  return toOrderDTO(row);
}
