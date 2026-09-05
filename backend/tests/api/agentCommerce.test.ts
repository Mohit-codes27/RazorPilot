import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { setAIProviderOverride } from '../../src/providers/ai/index.js';
import type { AIChatResult, AIProvider } from '../../src/providers/ai/aiProvider.js';

const app = createApp();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const catSlug = `p8test-cat-${stamp}`;
const merchantEmail = `p8test.merchant.${stamp}@example.com`;
const email = `p8test.${stamp}@example.com`;
const password = 'secure-password-1';

let token = '';
let merchantId = '';
let prodA = '';
let prodB = '';

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

function toolThenSummary(toolName: string, args: Record<string, unknown>, summary: string): void {
  ai.queue.push(
    { text: `Calling ${toolName}.`, toolCalls: [{ name: toolName, args }] },
    { text: summary, toolCalls: [] },
  );
}

async function postMsg(sessionId: string, message: string, confirmed = false) {
  return request(app)
    .post(`/api/v1/agent/sessions/${sessionId}/messages`)
    .set('Authorization', `Bearer ${token}`)
    .send({ message, confirmed });
}

async function lastToolCall(sessionId: string, toolName: string) {
  return prisma.agentToolCall.findFirstOrThrow({
    where: { sessionId, toolName },
    orderBy: { createdAt: 'desc' },
  });
}

beforeAll(async () => {
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'P8Test', email, password });
  expect(reg.status).toBe(201);
  token = reg.body.token as string;

  const merchant = await prisma.merchant.create({
    data: { name: 'P8Test Merchant', email: merchantEmail, status: 'ACTIVE' },
  });
  merchantId = merchant.id;
  const category = await prisma.productCategory.create({
    data: { name: 'P8Test Category', slug: catSlug },
  });
  const mk = (suffix: string, price: number) =>
    prisma.product.create({
      data: {
        merchantId,
        categoryId: category.id,
        name: `P8Test Headphone ${suffix} ${stamp}`,
        slug: `p8test-headphone-${suffix.toLowerCase()}-${stamp}`,
        description: `P8Test wireless headphone ${suffix}`,
        price,
        currency: 'INR',
        stockQuantity: 10,
        status: 'ACTIVE',
        attributes: { wireless: true },
      },
    });
  prodA = (await mk('A', 4000)).id;
  prodB = (await mk('B', 3000)).id;
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

async function createSession(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/agent/sessions')
    .set('Authorization', `Bearer ${token}`)
    .send({});
  expect(res.status).toBe(201);
  return res.body.session.id as string;
}

describe('Phase 8 — product tools through the agent', () => {
  it('search_products returns real catalog data', async () => {
    const id = await createSession();
    toolThenSummary('search_products', { query: 'P8Test Headphone' }, 'Found two options.');
    const res = await postMsg(id, 'Show me P8Test headphones');
    expect(res.status).toBe(200);
    expect(res.body.tool_calls).toEqual([{ name: 'search_products', status: 'SUCCEEDED' }]);
    const call = await lastToolCall(id, 'search_products');
    expect(JSON.stringify(call.result)).toContain(`P8Test Headphone A ${stamp}`);
  });

  it('get_product returns authoritative details', async () => {
    const id = await createSession();
    toolThenSummary('get_product', { product_id: prodA }, 'Here are the details.');
    const res = await postMsg(id, 'Tell me about the first one');
    expect(res.body.tool_calls).toEqual([{ name: 'get_product', status: 'SUCCEEDED' }]);
    const call = await lastToolCall(id, 'get_product');
    expect(JSON.stringify(call.result)).toContain('"price":4000');
  });

  it('compare_products returns normalized rows and flags missing ids', async () => {
    const id = await createSession();
    toolThenSummary(
      'compare_products',
      { product_ids: [prodA, prodB, '00000000-0000-0000-0000-000000000000'], criteria: ['price'] },
      'Comparison ready.',
    );
    const res = await postMsg(id, 'Compare them');
    expect(res.body.tool_calls).toEqual([{ name: 'compare_products', status: 'SUCCEEDED' }]);
    const call = await lastToolCall(id, 'compare_products');
    const result = call.result as unknown as { products: unknown[]; missing: string[] };
    expect(result.products).toHaveLength(2);
    expect(result.missing).toEqual(['00000000-0000-0000-0000-000000000000']);
  });

  it('get_product on unknown id fails gracefully with final text', async () => {
    const id = await createSession();
    toolThenSummary('get_product', { product_id: '00000000-0000-0000-0000-000000000000' }, 'That product does not exist.');
    const res = await postMsg(id, 'Tell me about a missing product');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('That product does not exist.');
    expect(res.body.tool_calls).toEqual([{ name: 'get_product', status: 'FAILED' }]);
  });
});

describe('Phase 8 — cart/order/payment tools through the agent', () => {
  it('add_to_cart then remove_from_cart update the real cart', async () => {
    const id = await createSession();
    toolThenSummary('add_to_cart', { product_id: prodA, quantity: 2 }, 'Added to cart.');
    const added = await postMsg(id, 'Add the first headphone twice');
    expect(added.body.tool_calls).toEqual([{ name: 'add_to_cart', status: 'SUCCEEDED' }]);

    const cart = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${token}`);
    expect(cart.body.cart.items).toHaveLength(1);
    expect(cart.body.cart.items[0]).toMatchObject({ productId: prodA, quantity: 2 });

    toolThenSummary('remove_from_cart', { product_id: prodA }, 'Removed.');
    const removed = await postMsg(id, 'Remove it again');
    expect(removed.body.tool_calls).toEqual([{ name: 'remove_from_cart', status: 'SUCCEEDED' }]);
    const empty = await request(app).get('/api/v1/cart').set('Authorization', `Bearer ${token}`);
    expect(empty.body.cart.items).toEqual([]);
  });

  it('preview_order reflects authoritative totals', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: prodA, quantity: 1 });
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: prodB, quantity: 1 });

    const id = await createSession();
    toolThenSummary('preview_order', {}, 'Total is 7000.');
    const res = await postMsg(id, 'How much will it cost?');
    expect(res.body.tool_calls).toEqual([{ name: 'preview_order', status: 'SUCCEEDED' }]);
    const call = await lastToolCall(id, 'preview_order');
    expect(call.result as unknown as Record<string, unknown>).toMatchObject({ subtotal: 7000, total: 7000 });
  });

  it('create_order creates PENDING_PAYMENT and reserves stock', async () => {
    const id = await createSession();
    toolThenSummary('create_order', {}, 'Order created.');
    const res = await postMsg(id, 'Buy it');
    expect(res.body.tool_calls).toEqual([{ name: 'create_order', status: 'SUCCEEDED' }]);
    const call = await lastToolCall(id, 'create_order');
    expect(call.result as unknown as Record<string, unknown>).toMatchObject({ status: 'PENDING_PAYMENT' });

    const stockA = await prisma.product.findUniqueOrThrow({ where: { id: prodA } });
    expect(stockA.stockQuantity).toBe(9);
  });

  it('prepare_payment is BLOCKED without explicit confirmation', async () => {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: prodB, quantity: 1 });

    const id = await createSession();
    toolThenSummary('prepare_payment', {}, 'Cannot proceed without confirmation.');
    const res = await postMsg(id, 'Pay for it');
    expect(res.body.tool_calls).toEqual([{ name: 'prepare_payment', status: 'FAILED' }]);
    const call = await lastToolCall(id, 'prepare_payment');
    expect(call.status).toBe('BLOCKED');
  });

  it('prepare_payment returns checkout data with explicit confirmation', async () => {
    const id = await createSession();
    toolThenSummary('prepare_payment', {}, 'Checkout ready.');
    const res = await postMsg(id, 'Yes, pay for it', true);
    expect(res.body.tool_calls).toEqual([{ name: 'prepare_payment', status: 'SUCCEEDED' }]);
    const call = await lastToolCall(id, 'prepare_payment');
    const result = call.result as unknown as {
      order: { status: string };
      checkout: { providerOrderId: string; amount: number };
    };
    expect(result.order.status).toBe('PENDING_PAYMENT');
    expect(result.checkout.providerOrderId).toMatch(/^order_sim_/);
    expect(result.checkout.amount).toBe(3000);
  });
});
