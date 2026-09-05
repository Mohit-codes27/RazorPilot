import { createHmac } from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const catSlug = `p6wtest-cat-${stamp}`;
const merchantEmail = `p6wtest.merchant.${stamp}@example.com`;
const email = `p6wtest.${stamp}@example.com`;
const password = 'secure-password-1';
const WEBHOOK_SECRET = `whsec-test-${stamp}`;

let token = '';
let merchantId = '';
let prodId = '';

process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

async function makeOrderWithPayment(): Promise<{ orderId: string; providerOrderId: string }> {
  await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${token}`);
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: prodId, quantity: 1 });
  const order = await request(app).post('/api/v1/orders').set('Authorization', `Bearer ${token}`);
  expect(order.status).toBe(201);
  const payment = await request(app)
    .post('/api/v1/payments/create')
    .set('Authorization', `Bearer ${token}`)
    .send({ orderId: order.body.order.id });
  expect(payment.status).toBe(201);
  return {
    orderId: order.body.order.id as string,
    providerOrderId: payment.body.payment.providerOrderId as string,
  };
}

function sign(raw: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
}

function payload(event: string, eventId: string, providerOrderId: string, providerPaymentId: string) {
  return {
    id: eventId,
    event,
    payload: {
      payment: {
        entity: {
          id: providerPaymentId,
          order_id: providerOrderId,
          status: event === 'payment.captured' ? 'captured' : 'failed',
          method: 'upi',
        },
      },
    },
  };
}

async function sendWebhook(body: unknown, signature: string) {
  const raw = JSON.stringify(body);
  return request(app)
    .post('/api/v1/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('x-razorpay-signature', signature)
    .send(raw);
}

beforeAll(async () => {
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'P6WTest', email, password });
  expect(reg.status).toBe(201);
  token = reg.body.token as string;

  const merchant = await prisma.merchant.create({
    data: { name: 'P6WTest Merchant', email: merchantEmail, status: 'ACTIVE' },
  });
  merchantId = merchant.id;
  const category = await prisma.productCategory.create({
    data: { name: 'P6WTest Category', slug: catSlug },
  });
  prodId = (
    await prisma.product.create({
      data: {
        merchantId,
        categoryId: category.id,
        name: `P6WTest Product ${stamp}`,
        slug: `p6wtest-product-${stamp}`,
        description: 'P6WTest fixture',
        price: 1500,
        currency: 'INR',
        stockQuantity: 20,
        status: 'ACTIVE',
      },
    })
  ).id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email }, select: { id: true } });
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
  await prisma.merchant.deleteMany({ where: { email: merchantEmail } });
  await prisma.$disconnect();
});

describe('Phase 6 — POST /api/v1/webhooks/razorpay', () => {
  it('marks order PAID on payment.captured', async () => {
    const { orderId, providerOrderId } = await makeOrderWithPayment();
    const body = payload('payment.captured', `evt_${stamp}_1`, providerOrderId, 'pay_wh_1');
    const res = await sendWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(200);
    expect(res.body.orderStatus).toBe('PAID');

    const order = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${token}`);
    expect(order.body.order.status).toBe('PAID');
  });

  it('dedupes repeat delivery of the same event', async () => {
    const { providerOrderId } = await makeOrderWithPayment();
    const body = payload('payment.captured', `evt_${stamp}_2`, providerOrderId, 'pay_wh_2');
    const raw = JSON.stringify(body);
    const first = await sendWebhook(body, sign(raw));
    const second = await sendWebhook(JSON.parse(raw), sign(raw));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.deduped).toBe(true);
  });

  it('marks order PAYMENT_FAILED on payment.failed', async () => {
    const { orderId, providerOrderId } = await makeOrderWithPayment();
    const body = payload('payment.failed', `evt_${stamp}_3`, providerOrderId, 'pay_wh_3');
    const res = await sendWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(200);
    expect(res.body.orderStatus).toBe('PAYMENT_FAILED');

    const order = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${token}`);
    expect(order.body.order.status).toBe('PAYMENT_FAILED');
  });

  it('rejects invalid signatures with 401 and changes nothing', async () => {
    const { orderId, providerOrderId } = await makeOrderWithPayment();
    const body = payload('payment.captured', `evt_${stamp}_4`, providerOrderId, 'pay_wh_4');
    const res = await sendWebhook(body, 'bad-signature');
    expect(res.status).toBe(401);

    const order = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${token}`);
    expect(order.body.order.status).toBe('PENDING_PAYMENT');
  });

  it('acknowledges unknown event types without state changes', async () => {
    const { orderId } = await makeOrderWithPayment();
    const body = { id: `evt_${stamp}_5`, event: 'refund.processed', payload: {} };
    const res = await sendWebhook(body, sign(JSON.stringify(body)));
    expect(res.status).toBe(200);
    expect(res.body.orderStatus).toBeNull();

    const order = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${token}`);
    expect(order.body.order.status).toBe('PENDING_PAYMENT');
  });
});
