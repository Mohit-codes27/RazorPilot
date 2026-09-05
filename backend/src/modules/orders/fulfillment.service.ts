import { ORDER_STATUS } from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { getOrderById, type OrderDTO } from './order.service.js';

/**
 * Fulfillment state machine. Merchants advance their own orders along
 * PAID → PROCESSING → SHIPPED → DELIVERED (or cancel); shoppers may only
 * cancel their own unpaid orders. Cancellations restore reserved stock.
 */
const MERCHANT_TRANSITIONS: Record<string, string[]> = {
  [ORDER_STATUS.PAID]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
};

const USER_TRANSITIONS: Record<string, string[]> = {
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAYMENT_FAILED]: [ORDER_STATUS.CANCELLED],
};

export type FulfillmentActor =
  | { type: 'merchant'; id: string }
  | { type: 'user'; id: string };

export async function transitionOrder(
  actor: FulfillmentActor,
  orderId: string,
  toStatus: string,
): Promise<OrderDTO> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order not found');

  if (actor.type === 'merchant') {
    if (order.merchantId !== actor.id) throw new NotFoundError('Order not found');
    const allowed = MERCHANT_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ConflictError(`Cannot move order from ${order.status} to ${toStatus}`);
    }
  } else {
    if (order.userId !== actor.id) throw new NotFoundError('Order not found');
    const allowed = USER_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ConflictError(`Cannot move order from ${order.status} to ${toStatus}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: toStatus } });
    if (toStatus === ORDER_STATUS.CANCELLED) {
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
    }
    await tx.auditLog.create({
      data: {
        userId: actor.type === 'user' ? actor.id : null,
        entityType: 'ORDER',
        entityId: orderId,
        action: 'ORDER_STATUS_CHANGED',
        actorType: actor.type === 'merchant' ? 'MERCHANT' : 'USER',
        metadata: { from: order.status, to: toStatus },
      },
    });
  });

  const ownerId = actor.type === 'user' ? actor.id : order.userId;
  return getOrderById(ownerId, orderId);
}
