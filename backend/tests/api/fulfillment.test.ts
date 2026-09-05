import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { simulatorSignature } from '../../src/providers/payment/simulator.provider.js';

const app = createApp();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const catSlug = `fftest-cat-${stamp}`;
const merchantEmail = `fftest.merchant.${stamp}@example.com`;
const merchantEmailB = `fftest.merchantb.${stamp}@example.com`;
const emailA = `fftest.a.${stamp}@example.com`;
const emailB = `fftest.b.${stamp}@example.com`;
const password = 'secure-password-1';

let tokenM = '';
let tokenMB = '';
let tokenA = '';
let tokenB = '';
let merchantId = '';
let prodId = '';

async function registerUser(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'FfTest', email, password });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

async function registerMerchant(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/merchants/register')
    .send({ name: 'FfTest Merchant', email, password });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

const authM = (r: request.Test) => r.set('Authorization', `Bearer ${tokenM}`);
const authMB = (r: request.Test) => r.set('Authorization', `Bearer ${tokenMB}`);
const authA = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
const authB = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);

async function makeOrder(token: string): Promise<string> {
  await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${token}`);
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: prodId, quantity: 1 });
  const order = await request(app).post('/api/v1/orders').set('Authorization', `Bearer ${token}`);
  expect(order.status).toBe(201);
  return order.body.order.id as string;
}

async function payOrder(token: string, orderId: string, paymentId: string): Promise<string> {
  const payment = await request(app)
    .post('/api/v1/payments/create')
    .set('Authorization', `Bearer ${token}`)
    .send({ orderId });
  expect(payment.status).toBe(201);
  const po = payment.body.payment.providerOrderId as string;
  const verify = await request(app)
    .post('/api/v1/payments/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ providerOrderId: po, providerPaymentId: paymentId, signature: simulatorSignature(po, paymentId) });
  expect(verify.status).toBe(200);
  return payment.body.payment.id as string;
}

beforeAll(async () => {
  tokenM = await registerMerchant(merchantEmail);
  tokenMB = await registerMerchant(merchantEmailB);
  tokenA = await registerUser(emailA);
  tokenB = await registerUser(emailB);
  const merchant = await prisma.merchant.findUniqueOrThrow({ where: { email: merchantEmail } });
  merchantId = merchant.id;
  const category = await prisma.productCategory.create({
    data: { name: 'FfTest Category', slug: catSlug },
  });
  prodId = (
    await prisma.product.create({
      data: {
        merchantId,
        categoryId: category.id,
        name: `FfTest Product ${stamp}`,
        slug: `fftest-product-${stamp}`,
        description: 'FfTest fixture',
        price: 1000,
        currency: 'INR',
        stockQuantity: 10,
        status: 'ACTIVE',
      },
    })
  ).id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: [emailA, emailB] } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: ids } } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: ids } } } });
    await prisma.order.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.product.deleteMany({ where: { merchantId } });
  await prisma.productCategory.deleteMany({ where: { slug: catSlug } });
  await prisma.merchant.deleteMany({ where: { email: { in: [merchantEmail, merchantEmailB] } } });
  await prisma.$disconnect();
});

describe('Fulfillment — user cancellation', () => {
  it('cancels an unpaid order and restores stock with audit', async () => {
    const orderId = await makeOrder(tokenA);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: prodId } })).stockQuantity).toBe(9);

    const res = await authA(request(app).patch(`/api/v1/orders/${orderId}/status`).send({ status: 'CANCELLED' }));
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('CANCELLED');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: prodId } })).stockQuantity).toBe(10);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ORDER_STATUS_CHANGED', entityId: orderId },
    });
    expect(audit?.actorType).toBe('USER');
  });

  it('rejects cancelling PAID orders and other users orders', async () => {
    const orderId = await makeOrder(tokenA);
    await payOrder(tokenA, orderId, 'pay_ff_ok_1');

    const res = await authA(request(app).patch(`/api/v1/orders/${orderId}/status`).send({ status: 'CANCELLED' }));
    expect(res.status).toBe(409);
    expect((await authB(request(app).patch(`/api/v1/orders/${orderId}/status`).send({ status: 'CANCELLED' }))).status).toBe(404);
    expect(
      (await authA(request(app).patch(`/api/v1/orders/${orderId}/status`).send({ status: 'SHIPPED' }))).status,
    ).toBe(400);
  });
});

describe('Fulfillment — merchant advancement', () => {
  it('walks PAID → PROCESSING → SHIPPED → DELIVERED with timeline progress', async () => {
    const orderId = await makeOrder(tokenA);
    await payOrder(tokenA, orderId, 'pay_ff_ok_2');

    for (const [status, processing, shipped] of [
      ['PROCESSING', 'completed', 'current'],
      ['SHIPPED', 'completed', 'completed'],
      ['DELIVERED', 'completed', 'completed'],
    ] as const) {
      const res = await authM(
        request(app).patch(`/api/v1/merchants/me/orders/${orderId}/status`).send({ status }),
      );
      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe(status);
      const timeline = res.body.order.timeline as Array<{ type: string; status: string }>;
      expect(timeline.find((t) => t.type === 'PROCESSING')?.status).toBe(processing);
      expect(timeline.find((t) => t.type === 'SHIPPED')?.status).toBe(shipped);
    }
    const delivered = await authA(request(app).get(`/api/v1/orders/${orderId}`));
    expect(
      (delivered.body.order.timeline as Array<{ status: string }>).every((t) => t.status === 'completed'),
    ).toBe(true);
  });

  it('rejects illegal jumps, terminal states, and cross-merchant moves', async () => {
    const orderId = await makeOrder(tokenA);
    await payOrder(tokenA, orderId, 'pay_ff_ok_3');

    expect(
      (await authM(request(app).patch(`/api/v1/merchants/me/orders/${orderId}/status`).send({ status: 'SHIPPED' }))).status,
    ).toBe(409);
    expect(
      (await authMB(request(app).patch(`/api/v1/merchants/me/orders/${orderId}/status`).send({ status: 'PROCESSING' }))).status,
    ).toBe(404);

    await authM(request(app).patch(`/api/v1/merchants/me/orders/${orderId}/status`).send({ status: 'PROCESSING' }));
    await authM(request(app).patch(`/api/v1/merchants/me/orders/${orderId}/status`).send({ status: 'SHIPPED' }));
    await authM(request(app).patch(`/api/v1/merchants/me/orders/${orderId}/status`).send({ status: 'DELIVERED' }));
    expect(
      (await authM(request(app).patch(`/api/v1/merchants/me/orders/${orderId}/status`).send({ status: 'CANCELLED' }))).status,
    ).toBe(409);
  });

  it('merchant cancellation restores stock', async () => {
    const before = (await prisma.product.findUniqueOrThrow({ where: { id: prodId } })).stockQuantity;
    const orderId = await makeOrder(tokenA);
    await payOrder(tokenA, orderId, 'pay_ff_ok_4');
    const res = await authM(
      request(app).patch(`/api/v1/merchants/me/orders/${orderId}/status`).send({ status: 'CANCELLED' }),
    );
    expect(res.status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: prodId } })).stockQuantity).toBe(before);
  });
});

describe('Refunds', () => {
  it('refunds a captured payment, cancels the order, restores stock', async () => {
    const before = (await prisma.product.findUniqueOrThrow({ where: { id: prodId } })).stockQuantity;
    const orderId = await makeOrder(tokenA);
    const paymentId = await payOrder(tokenA, orderId, 'pay_ff_ok_5');

    const res = await authA(request(app).post(`/api/v1/payments/${paymentId}/refund`));
    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('REFUNDED');
    expect(res.body.payment.providerRefundId).toMatch(/^refund_sim_/);
    expect(res.body.orderStatus).toBe('CANCELLED');

    const order = await authA(request(app).get(`/api/v1/orders/${orderId}`));
    expect(order.body.order.status).toBe('CANCELLED');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: prodId } })).stockQuantity).toBe(before);
  });

  it('rejects double refunds, open payments, and foreign payments', async () => {
    const orderId = await makeOrder(tokenA);
    const paymentId = await payOrder(tokenA, orderId, 'pay_ff_ok_6');
    expect((await authA(request(app).post(`/api/v1/payments/${paymentId}/refund`))).status).toBe(200);
    expect((await authA(request(app).post(`/api/v1/payments/${paymentId}/refund`))).status).toBe(409);
    expect((await authB(request(app).post(`/api/v1/payments/${paymentId}/refund`))).status).toBe(404);

    const orderId2 = await makeOrder(tokenA);
    const pay = await authA(request(app).post('/api/v1/payments/create').send({ orderId: orderId2 }));
    expect((await authA(request(app).post(`/api/v1/payments/${pay.body.payment.id}/refund`))).status).toBe(409);
  });
});
