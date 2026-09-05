import { Prisma } from '@prisma/client';
import { ORDER_STATUS, PAYMENT_STATUS } from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';
import { getPaymentProvider } from '../../providers/payment/index.js';
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
  OrderAlreadyPaidError,
  ProviderError,
} from '../../utils/errors.js';
import type { VerifyPaymentInput } from './payment.schemas.js';

const paymentSelect = {
  id: true,
  orderId: true,
  provider: true,
  providerOrderId: true,
  providerPaymentId: true,
  providerRefundId: true,
  amount: true,
  currency: true,
  status: true,
  method: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

export interface PaymentDTO {
  id: string;
  orderId: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  providerRefundId: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toPaymentDTO(row: PaymentRow): PaymentDTO {
  return {
    id: row.id,
    orderId: row.orderId,
    provider: row.provider,
    providerOrderId: row.providerOrderId,
    providerPaymentId: row.providerPaymentId,
    providerRefundId: row.providerRefundId,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    method: row.method,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface CheckoutData {
  keyId: string;
  razorpayKeyId: string;
  providerOrderId: string;
  razorpayOrderId: string;
  /** Major unit (rupees for INR). */
  amount: number;
  amountRupees: number;
  /** Smallest currency unit (paise for INR) — what Razorpay charges. */
  amountPaise: number;
  currency: string;
  orderId: string;
  orderNumber: string;
  paymentStatus: 'created' | 'pending';
  requiresUserConfirmation: boolean;
}

/** Paise from a rupee major-unit amount. */
export function toPaise(amountRupees: number): number {
  return Math.round(amountRupees * 100);
}

function keyIdForProvider(provider: string): string {
  if (provider === 'razorpay') return process.env.RAZORPAY_KEY_ID || '';
  return 'simulator';
}

function buildCheckout(input: {
  keyId: string;
  providerOrderId: string;
  amount: number;
  currency: string;
  orderId: string;
  orderNumber: string;
}): CheckoutData {
  return {
    keyId: input.keyId,
    razorpayKeyId: input.keyId,
    providerOrderId: input.providerOrderId,
    razorpayOrderId: input.providerOrderId,
    amount: input.amount,
    amountRupees: input.amount,
    amountPaise: toPaise(input.amount),
    currency: input.currency,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    paymentStatus: 'created',
    requiresUserConfirmation: true,
  };
}

async function loadPayableOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new NotFoundError('Order not found');
  if (order.status === ORDER_STATUS.PAID) {
    throw new OrderAlreadyPaidError();
  }
  if (
    order.status !== ORDER_STATUS.PENDING_PAYMENT &&
    order.status !== ORDER_STATUS.PAYMENT_FAILED
  ) {
    throw new ConflictError(`Order cannot be paid in status ${order.status}`);
  }
  return order;
}

/**
 * Creates a provider payment order for the user's order. The amount always
 * comes from the authoritative order total — never from client input.
 * Reuses the open payment when called again (safe retries + idempotency).
 */
export async function createPayment(
  userId: string,
  orderId: string,
  idempotencyKey: string | null,
): Promise<{ payment: PaymentDTO; checkout: CheckoutData; created: boolean }> {
  const order = await loadPayableOrder(userId, orderId);

  if (idempotencyKey) {
    const existing = await prisma.payment.findFirst({
      where: { orderId: order.id, idempotencyKey },
      select: paymentSelect,
    });
    if (existing) {
      return { payment: toPaymentDTO(existing), checkout: toCheckout(existing), created: false };
    }
  }

  const open = await prisma.payment.findFirst({
    where: {
      orderId: order.id,
      status: { in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.AUTHORIZED] },
    },
    select: paymentSelect,
  });
  if (open) {
    return { payment: toPaymentDTO(open), checkout: toCheckout(open), created: false };
  }

  const provider = getPaymentProvider();
  let providerOrderId: string;
  let keyId: string;
  try {
    const created = await provider.createPaymentOrder({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(order.totalAmount),
      currency: order.currency,
    });
    providerOrderId = created.providerOrderId;
    keyId = created.keyId;
  } catch (err) {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: provider.name,
        amount: order.totalAmount,
        currency: order.currency,
        status: PAYMENT_STATUS.FAILED,
        failureReason: `provider_order_failed: ${String(err)}`,
        idempotencyKey,
      },
    });
    throw err instanceof Error ? err : new ProviderError('Payment provider failed');
  }

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: provider.name,
      providerOrderId,
      amount: order.totalAmount,
      currency: order.currency,
      status: PAYMENT_STATUS.CREATED,
      idempotencyKey,
    },
    select: paymentSelect,
  });

  await prisma.auditLog.create({
    data: {
      userId,
      entityType: 'PAYMENT',
      entityId: payment.id,
      action: 'PAYMENT_ORDER_CREATED',
      actorType: 'USER',
      metadata: { orderId: order.id, provider: provider.name, providerOrderId },
    },
  });

  return {
    payment: toPaymentDTO(payment),
    checkout: buildCheckout({
      keyId,
      providerOrderId,
      amount: Number(order.totalAmount),
      currency: order.currency,
      orderId: order.id,
      orderNumber: order.orderNumber,
    }),
    created: true,
  };
}

function toCheckout(row: PaymentRow): CheckoutData {
  return buildCheckout({
    keyId: keyIdForProvider(row.provider),
    providerOrderId: row.providerOrderId ?? '',
    amount: Number(row.amount),
    currency: row.currency,
    orderId: row.orderId,
    orderNumber: '',
  });
}

/**
 * Verifies a completed checkout against the provider. Only a valid provider
 * signature moves money states — the frontend's word is never trusted.
 */
export async function verifyPayment(
  userId: string,
  input: VerifyPaymentInput,
): Promise<{ verified: boolean; payment: PaymentDTO; orderStatus: string }> {
  const payment = await prisma.payment.findFirst({
    where: { providerOrderId: input.providerOrderId, order: { userId } },
    select: { ...paymentSelect, order: { select: { id: true, status: true } } },
  });
  if (!payment) throw new NotFoundError('Payment not found');
  if (
    payment.status === PAYMENT_STATUS.CAPTURED ||
    payment.status === PAYMENT_STATUS.REFUNDED
  ) {
    throw new ConflictError('Payment is already settled');
  }

  const provider = getPaymentProvider();
  const result = await provider.verifyPayment({
    providerOrderId: input.providerOrderId,
    providerPaymentId: input.providerPaymentId,
    signature: input.signature,
  });

  if (!result.verified && result.reason === 'invalid_signature') {
    throw new AuthenticationError('Invalid payment signature');
  }

  if (!result.verified) {
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: input.providerPaymentId,
          status: PAYMENT_STATUS.FAILED,
          failureReason: result.reason ?? 'provider_verification_failed',
        },
        select: paymentSelect,
      });
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: ORDER_STATUS.PAYMENT_FAILED },
      });
      await tx.auditLog.create({
        data: {
          userId,
          entityType: 'PAYMENT',
          entityId: payment.id,
          action: 'PAYMENT_FAILED',
          actorType: 'USER',
          metadata: { orderId: payment.orderId, reason: p.failureReason },
        },
      });
      return p;
    });
    return { verified: false, payment: toPaymentDTO(updated), orderStatus: ORDER_STATUS.PAYMENT_FAILED };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: input.providerPaymentId,
        status: PAYMENT_STATUS.CAPTURED,
        method: result.method,
        failureReason: null,
      },
      select: paymentSelect,
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: ORDER_STATUS.PAID },
    });
    await tx.auditLog.create({
      data: {
        userId,
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'PAYMENT_VERIFIED',
        actorType: 'USER',
        metadata: { orderId: payment.orderId, providerPaymentId: input.providerPaymentId },
      },
    });
    return p;
  });
  return { verified: true, payment: toPaymentDTO(updated), orderStatus: ORDER_STATUS.PAID };
}

export async function getPayment(userId: string, paymentId: string): Promise<PaymentDTO> {
  const row = await prisma.payment.findFirst({
    where: { id: paymentId, order: { userId } },
    select: paymentSelect,
  });
  if (!row) throw new NotFoundError('Payment not found');
  return toPaymentDTO(row);
}

/**
 * Refunds a captured payment to the shopper. Only the order owner may refund,
 * only CAPTURED payments, and only while the order is PAID or PROCESSING.
 * Restores reserved stock and cancels the order atomically.
 */
export async function refundPayment(
  userId: string,
  paymentId: string,
): Promise<{ payment: PaymentDTO; orderStatus: string }> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, order: { userId } },
    select: { ...paymentSelect, order: { select: { id: true, status: true } } },
  });
  if (!payment) throw new NotFoundError('Payment not found');
  if (payment.status !== PAYMENT_STATUS.CAPTURED) {
    throw new ConflictError('Only captured payments can be refunded');
  }
  if (
    payment.order.status !== ORDER_STATUS.PAID &&
    payment.order.status !== ORDER_STATUS.PROCESSING
  ) {
    throw new ConflictError(`Order cannot be refunded in status ${payment.order.status}`);
  }
  if (!payment.providerPaymentId) {
    throw new ConflictError('Payment has no provider reference');
  }

  const provider = getPaymentProvider();
  const refund = await provider.refundPayment(payment.providerPaymentId, Number(payment.amount));

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.update({
      where: { id: payment.id },
      data: { status: PAYMENT_STATUS.REFUNDED, providerRefundId: refund.refundId },
      select: paymentSelect,
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: ORDER_STATUS.CANCELLED },
    });
    const items = await tx.orderItem.findMany({ where: { orderId: payment.orderId } });
    for (const item of items) {
      if (!item.productId) continue;
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }
    await tx.auditLog.create({
      data: {
        userId,
        entityType: 'PAYMENT',
        entityId: payment.id,
        action: 'PAYMENT_REFUNDED',
        actorType: 'USER',
        metadata: { orderId: payment.orderId, refundId: refund.refundId },
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        entityType: 'ORDER',
        entityId: payment.orderId,
        action: 'ORDER_STATUS_CHANGED',
        actorType: 'USER',
        metadata: { from: payment.order.status, to: ORDER_STATUS.CANCELLED },
      },
    });
    return p;
  });
  return { payment: toPaymentDTO(updated), orderStatus: ORDER_STATUS.CANCELLED };
}

interface WebhookOutcome {
  deduped: boolean;
  processed: boolean;
  orderStatus: string | null;
}

/**
 * Processes a verified Razorpay webhook payload. Safe to retry: event_id
 * deduplication plus terminal-state guards make re-delivery a no-op.
 */
export async function processRazorpayWebhook(
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<WebhookOutcome> {
  const seen = await prisma.webhookEvent.findUnique({ where: { eventId } });
  if (seen) return { deduped: true, processed: seen.processed, orderStatus: null };

  const stored = await prisma.webhookEvent.create({
    data: {
      provider: 'razorpay',
      eventId,
      eventType,
      payload: (payload ?? {}) as Prisma.InputJsonValue,
      processed: false,
    },
  });

  const entity = (payload as { payload?: { payment?: { entity?: Record<string, unknown> } } })
    ?.payload?.payment?.entity;
  let orderStatus: string | null = null;

  if (eventType === 'payment.captured' || eventType === 'payment.failed') {
    const providerOrderId = typeof entity?.['order_id'] === 'string' ? (entity['order_id'] as string) : null;
    const providerPaymentId = typeof entity?.['id'] === 'string' ? (entity['id'] as string) : null;
    if (providerOrderId && providerPaymentId) {
      const payment = await prisma.payment.findFirst({
        where: { providerOrderId },
        select: { ...paymentSelect, order: { select: { id: true, userId: true, status: true } } },
      });
      if (payment) {
        const terminal =
          payment.status === PAYMENT_STATUS.CAPTURED || payment.status === PAYMENT_STATUS.REFUNDED;
        if (!terminal) {
          const success = eventType === 'payment.captured';
          await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                providerPaymentId,
                status: success ? PAYMENT_STATUS.CAPTURED : PAYMENT_STATUS.FAILED,
                method: typeof entity?.['method'] === 'string' ? (entity['method'] as string) : payment.method,
                failureReason: success
                  ? null
                  : typeof entity?.['error_description'] === 'string'
                    ? (entity['error_description'] as string)
                    : 'webhook_reported_failure',
              },
            });
            await tx.order.update({
              where: { id: payment.orderId },
              data: { status: success ? ORDER_STATUS.PAID : ORDER_STATUS.PAYMENT_FAILED },
            });
            await tx.auditLog.create({
              data: {
                userId: payment.order.userId,
                entityType: 'PAYMENT',
                entityId: payment.id,
                action: success ? 'PAYMENT_VERIFIED' : 'PAYMENT_FAILED',
                actorType: 'WEBHOOK',
                metadata: { orderId: payment.orderId, eventId, eventType },
              },
            });
          });
          orderStatus = success ? ORDER_STATUS.PAID : ORDER_STATUS.PAYMENT_FAILED;
        }
      }
    }
  }

  await prisma.webhookEvent.update({
    where: { id: stored.id },
    data: { processed: true, processedAt: new Date() },
  });
  return { deduped: false, processed: true, orderStatus };
}
