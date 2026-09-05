import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { simulatorSignature } from '../../src/providers/payment/simulator.provider.js';

const app = createApp();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const catSlug = `p6test-cat-${stamp}`;
const merchantEmail = `p6test.merchant.${stamp}@example.com`;
const emailA = `p6test.a.${stamp}@example.com`;
const emailB = `p6test.b.${stamp}@example.com`;
const password = 'secure-password-1';

let tokenA = '';
let tokenB = '';
let merchantId = '';
let prodId = '';
let orderIdA = '';

async function register(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'P6Test', email, password });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

const authA = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
const authB = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);

async function makeOrder(token: string, productId: string, qty: number): Promise<string> {
  await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${token}`);
  const added = await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity: qty });
  expect(added.status).toBe(200);
  const created = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${token}`);
  expect(created.status).toBe(201);
  return created.body.order.id as string;
}

beforeAll(async () => {
  tokenA = await register(emailA);
  tokenB = await register(emailB);
  const merchant = await prisma.merchant.create({
    data: { name: 'P6Test Merchant', email: merchantEmail, status: 'ACTIVE' },
  });
  merchantId = merchant.id;
  const category = await prisma.productCategory.create({
    data: { name: 'P6Test Category', slug: catSlug },
  });
  prodId = (
    await prisma.product.create({
      data: {
        merchantId,
        categoryId: category.id,
        name: `P6Test Product ${stamp}`,
        slug: `p6test-product-${stamp}`,
        description: 'P6Test fixture',
        price: 2000,
        currency: 'INR',
        stockQuantity: 20,
        status: 'ACTIVE',
      },
    })
  ).id;
  orderIdA = await makeOrder(tokenA, prodId, 1);
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
  await prisma.merchant.deleteMany({ where: { email: merchantEmail } });
  await prisma.$disconnect();
});

describe('Phase 6 — POST /api/v1/payments/create', () => {
  it('rejects unauthenticated access', async () => {
    expect((await request(app).post('/api/v1/payments/create').send({ orderId: orderIdA })).status).toBe(401);
  });

  it('creates a provider order from the authoritative order total', async () => {
    const res = await authA(
      request(app).post('/api/v1/payments/create').send({ orderId: orderIdA, amount: 1 }),
    );
    expect(res.status).toBe(201);
    expect(res.body.payment.status).toBe('CREATED');
    expect(res.body.payment.amount).toBe(2000);
    expect(res.body.checkout.providerOrderId).toMatch(/^order_sim_/);
    expect(res.body.checkout.amount).toBe(2000);
    expect(res.body.checkout.keyId).toBe('simulator');
  });

  it('reuses the open payment on retry (no duplicates)', async () => {
    const first = await authA(request(app).post('/api/v1/payments/create').send({ orderId: orderIdA }));
    expect(first.status).toBe(200);
    const count = await prisma.payment.count({ where: { orderId: orderIdA } });
    expect(count).toBe(1);
  });

  it('is idempotent for the same Idempotency-Key', async () => {
    const key = `p6test-key-${stamp}`;
    const first = await authA(
      request(app).post('/api/v1/payments/create').set('Idempotency-Key', key).send({ orderId: orderIdA }),
    );
    const second = await authA(
      request(app).post('/api/v1/payments/create').set('Idempotency-Key', key).send({ orderId: orderIdA }),
    );
    expect(second.body.payment.id).toBe(first.body.payment.id);
  });

  it('rejects other users orders with 404 and unknown orders', async () => {
    expect((await authB(request(app).post('/api/v1/payments/create').send({ orderId: orderIdA }))).status).toBe(404);
    expect(
      (await authA(request(app).post('/api/v1/payments/create').send({ orderId: '00000000-0000-0000-0000-000000000000' }))).status,
    ).toBe(404);
  });
});

describe('Phase 6 — POST /api/v1/payments/verify', () => {
  it('captures payment and marks order PAID on valid signature', async () => {
    const created = await authA(request(app).post('/api/v1/payments/create').send({ orderId: orderIdA }));
    const providerOrderId = created.body.payment.providerOrderId as string;
    const res = await authA(
      request(app).post('/api/v1/payments/verify').send({
        providerOrderId,
        providerPaymentId: 'pay_ok_123',
        signature: simulatorSignature(providerOrderId, 'pay_ok_123'),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.payment.status).toBe('CAPTURED');
    expect(res.body.orderStatus).toBe('PAID');

    const order = await authA(request(app).get(`/api/v1/orders/${orderIdA}`));
    expect(order.body.order.status).toBe('PAID');
  });

  it('rejects tampered signatures with 401 and never marks PAID', async () => {
    const orderId = await makeOrder(tokenA, prodId, 1);
    const created = await authA(request(app).post('/api/v1/payments/create').send({ orderId }));
    const providerOrderId = created.body.payment.providerOrderId as string;
    const res = await authA(
      request(app).post('/api/v1/payments/verify').send({
        providerOrderId,
        providerPaymentId: 'pay_ok_123',
        signature: 'tampered',
      }),
    );
    expect(res.status).toBe(401);
    const order = await authA(request(app).get(`/api/v1/orders/${orderId}`));
    expect(order.body.order.status).toBe('PENDING_PAYMENT');
  });

  it('records failure without PAID on provider-reported failure', async () => {
    const orderId = await makeOrder(tokenA, prodId, 1);
    const created = await authA(request(app).post('/api/v1/payments/create').send({ orderId }));
    const providerOrderId = created.body.payment.providerOrderId as string;
    const res = await authA(
      request(app).post('/api/v1/payments/verify').send({
        providerOrderId,
        providerPaymentId: 'pay_fail_card',
        signature: simulatorSignature(providerOrderId, 'pay_fail_card'),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
    expect(res.body.payment.status).toBe('FAILED');
    expect(res.body.orderStatus).toBe('PAYMENT_FAILED');
  });

  it('returns 404 for unknown provider orders', async () => {
    const res = await authA(
      request(app).post('/api/v1/payments/verify').send({
        providerOrderId: 'order_sim_missing',
        providerPaymentId: 'pay_x',
        signature: 'sig',
      }),
    );
    expect(res.status).toBe(404);
  });

  it('blocks new payment creation on PAID orders, allows retry after failure', async () => {
    const paid = await authA(request(app).post('/api/v1/payments/create').send({ orderId: orderIdA }));
    expect(paid.status).toBe(409);

    const failedOrder = await makeOrder(tokenA, prodId, 1);
    const c1 = await authA(request(app).post('/api/v1/payments/create').send({ orderId: failedOrder }));
    const po = c1.body.payment.providerOrderId as string;
    await authA(
      request(app).post('/api/v1/payments/verify').send({
        providerOrderId: po,
        providerPaymentId: 'pay_fail_retry',
        signature: simulatorSignature(po, 'pay_fail_retry'),
      }),
    );
    const retry = await authA(request(app).post('/api/v1/payments/create').send({ orderId: failedOrder }));
    expect(retry.status).toBe(201);
    expect(retry.body.payment.id).not.toBe(c1.body.payment.id);
  });
});

describe('Phase 6 — GET /api/v1/payments/:id', () => {
  it('returns own payment, isolates others, validates ids', async () => {
    const list = await prisma.payment.findFirstOrThrow({ where: { orderId: orderIdA } });
    const mine = await authA(request(app).get(`/api/v1/payments/${list.id}`));
    expect(mine.status).toBe(200);
    expect(mine.body.payment.orderId).toBe(orderIdA);

    expect((await authB(request(app).get(`/api/v1/payments/${list.id}`))).status).toBe(404);
    expect((await authA(request(app).get('/api/v1/payments/not-a-uuid'))).status).toBe(400);
    expect((await request(app).get(`/api/v1/payments/${list.id}`)).status).toBe(401);
  });
});
