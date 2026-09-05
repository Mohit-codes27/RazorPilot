import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { setAIProviderOverride } from '../../src/providers/ai/index.js';
import type { AIChatResult, AIProvider } from '../../src/providers/ai/aiProvider.js';
import { simulatorSignature } from '../../src/providers/payment/simulator.provider.js';

const app = createApp();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const catSlug = `p10test-cat-${stamp}`;
const merchantEmail = `p10test.merchant.${stamp}@example.com`;
const email = `p10test.${stamp}@example.com`;
const password = 'secure-password-1';

let token = '';
let merchantId = '';
let prodId = '';

class ScriptedAI implements AIProvider {
  readonly name = 'scripted';
  queue: Array<AIChatResult | Error> = [];
  async chat(): Promise<AIChatResult> {
    const next = this.queue.shift();
    if (!next) return { text: 'done', toolCalls: [] };
    if (next instanceof Error) throw next;
    return next;
  }
}

const ai = new ScriptedAI();
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

async function makePaidOrder(paymentId: string): Promise<string> {
  await auth(request(app).delete('/api/v1/cart'));
  await auth(request(app).post('/api/v1/cart/items').send({ productId: prodId, quantity: 1 }));
  const order = await auth(request(app).post('/api/v1/orders'));
  expect(order.status).toBe(201);
  const payment = await auth(
    request(app).post('/api/v1/payments/create').send({ orderId: order.body.order.id }),
  );
  const providerOrderId = payment.body.payment.providerOrderId as string;
  const verify = await auth(
    request(app).post('/api/v1/payments/verify').send({
      providerOrderId,
      providerPaymentId: paymentId,
      signature: simulatorSignature(providerOrderId, paymentId),
    }),
  );
  return verify.body.orderStatus as string;
}

beforeAll(async () => {
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'P10Test', email, password });
  expect(reg.status).toBe(201);
  token = reg.body.token as string;

  const merchant = await prisma.merchant.create({
    data: { name: 'P10Test Merchant', email: merchantEmail, status: 'ACTIVE' },
  });
  merchantId = merchant.id;
  const category = await prisma.productCategory.create({
    data: { name: 'P10Test Category', slug: catSlug },
  });
  prodId = (
    await prisma.product.create({
      data: {
        merchantId,
        categoryId: category.id,
        name: `P10Test Product ${stamp}`,
        slug: `p10test-product-${stamp}`,
        description: 'P10Test fixture',
        price: 2000,
        currency: 'INR',
        stockQuantity: 30,
        status: 'ACTIVE',
      },
    })
  ).id;
  setAIProviderOverride(ai);
});

afterAll(async () => {
  setAIProviderOverride(null);
  const users = await prisma.user.findMany({ where: { email }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.agentToolCall.deleteMany({ where: { session: { userId: { in: ids } } } });
    await prisma.agentMessage.deleteMany({ where: { session: { userId: { in: ids } } } });
    await prisma.agentSession.deleteMany({ where: { userId: { in: ids } } });
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

describe('Phase 10 — payment timeout leaves states open for retry', () => {
  it('502 on timeout, payment stays CREATED, retry then succeeds', async () => {
    await auth(request(app).delete('/api/v1/cart'));
    await auth(request(app).post('/api/v1/cart/items').send({ productId: prodId, quantity: 1 }));
    const order = await auth(request(app).post('/api/v1/orders'));
    const payment = await auth(
      request(app).post('/api/v1/payments/create').send({ orderId: order.body.order.id }),
    );
    const providerOrderId = payment.body.payment.providerOrderId as string;

    const timeout = await auth(
      request(app).post('/api/v1/payments/verify').send({
        providerOrderId,
        providerPaymentId: 'pay_timeout_1',
        signature: simulatorSignature(providerOrderId, 'pay_timeout_1'),
      }),
    );
    expect(timeout.status).toBe(502);
    expect(timeout.body.error.code).toBe('PROVIDER_ERROR');

    const stillOpen = await auth(request(app).get(`/api/v1/payments/${payment.body.payment.id}`));
    expect(stillOpen.body.payment.status).toBe('CREATED');
    const orderStillPending = await auth(request(app).get(`/api/v1/orders/${order.body.order.id}`));
    expect(orderStillPending.body.order.status).toBe('PENDING_PAYMENT');

    const retry = await auth(
      request(app).post('/api/v1/payments/verify').send({
        providerOrderId,
        providerPaymentId: 'pay_ok_retry',
        signature: simulatorSignature(providerOrderId, 'pay_ok_retry'),
      }),
    );
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ verified: true, orderStatus: 'PAID' });
  });
});

describe('Phase 10 — analytics endpoints', () => {
  it('rejects unauthenticated access on all four endpoints', async () => {
    for (const path of ['overview', 'orders', 'payments', 'agent']) {
      expect((await request(app).get(`/api/v1/analytics/${path}`)).status).toBe(401);
    }
  });

  it('reflects success, failure, and agent activity in metrics', async () => {
    expect(await makePaidOrder('pay_ok_a10')).toBe('PAID');
    expect(await makePaidOrder('pay_fail_a10')).toBe('PAYMENT_FAILED');

    // One agent turn with a real tool call.
    const session = await auth(request(app).post('/api/v1/agent/sessions').send({}));
    expect(session.status).toBe(201);
    ai.queue.push(
      { text: 'Searching.', toolCalls: [{ name: 'search_products', args: { query: 'P10Test' } }] },
      { text: 'Found it.', toolCalls: [] },
    );
    const msg = await auth(
      request(app).post(`/api/v1/agent/sessions/${session.body.session.id}/messages`).send({ message: 'Find P10Test' }),
    );
    expect(msg.body.tool_calls).toEqual([{ name: 'search_products', status: 'SUCCEEDED' }]);

    const orders = await auth(request(app).get('/api/v1/analytics/orders'));
    expect(orders.status).toBe(200);
    expect(orders.body.totalOrders).toBeGreaterThanOrEqual(2);
    expect(orders.body.paidOrders).toBeGreaterThanOrEqual(1);
    expect(orders.body.failedPayments).toBeGreaterThanOrEqual(1);
    expect(orders.body.totalRevenue).toBeGreaterThanOrEqual(2000);
    expect(orders.body.averageOrderValue).toBeCloseTo(
      orders.body.totalRevenue / orders.body.paidOrders,
    );
    expect(Array.isArray(orders.body.byStatus)).toBe(true);

    const payments = await auth(request(app).get('/api/v1/analytics/payments'));
    expect(payments.body.capturedPayments).toBeGreaterThanOrEqual(1);
    expect(payments.body.failedPayments).toBeGreaterThanOrEqual(1);
    expect(payments.body.capturedAmount).toBeGreaterThanOrEqual(2000);

    const agent = await auth(request(app).get('/api/v1/analytics/agent'));
    expect(agent.body.agentSessions).toBeGreaterThanOrEqual(1);
    expect(agent.body.toolCalls).toBeGreaterThanOrEqual(1);
    expect(agent.body.successfulToolCalls).toBeGreaterThanOrEqual(1);
    expect(agent.body.callsByTool.some((t: { toolName: string }) => t.toolName === 'search_products')).toBe(true);

    const overview = await auth(request(app).get('/api/v1/analytics/overview'));
    expect(overview.status).toBe(200);
    expect(overview.body).toHaveProperty('orders.totalOrders');
    expect(overview.body).toHaveProperty('payments.capturedAmount');
    expect(overview.body).toHaveProperty('agent.toolCalls');
  });
});
