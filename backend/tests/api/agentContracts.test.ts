import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { setAIProviderOverride } from '../../src/providers/ai/index.js';
import type { AIChatResult, AIProvider } from '../../src/providers/ai/aiProvider.js';

const app = createApp();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const catSlug = `fx2test-cat-${stamp}`;
const merchantEmail = `fx2test.merchant.${stamp}@example.com`;
const emailA = `fx2test.a.${stamp}@example.com`;
const emailB = `fx2test.b.${stamp}@example.com`;
const password = 'secure-password-1';

let tokenA = '';
let tokenB = '';
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
const authA = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
const authB = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);

beforeAll(async () => {
  for (const email of [emailA, emailB]) {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Fx2Test', email, password });
    expect(reg.status).toBe(201);
    if (email === emailA) tokenA = reg.body.token as string;
    else tokenB = reg.body.token as string;
  }
  const merchant = await prisma.merchant.create({
    data: { name: 'Fx2Test Merchant', email: merchantEmail, status: 'ACTIVE' },
  });
  merchantId = merchant.id;
  const category = await prisma.productCategory.create({
    data: { name: 'Fx2Test Category', slug: catSlug },
  });
  prodId = (
    await prisma.product.create({
      data: {
        merchantId,
        categoryId: category.id,
        name: `Fx2Test Headphone ${stamp}`,
        slug: `fx2test-headphone-${stamp}`,
        description: 'Fx2Test wireless headphone',
        price: 4000,
        currency: 'INR',
        stockQuantity: 10,
        status: 'ACTIVE',
        attributes: { wireless: true, battery_hours: 60 },
      },
    })
  ).id;
  await prisma.userPreference.create({
    data: {
      userId: (await prisma.user.findUniqueOrThrow({ where: { email: emailA } })).id,
      preferredCurrency: 'INR',
      maxBudget: 5000,
      preferences: { wireless: true, priorities: ['comfort', 'battery'] },
    },
  });
  setAIProviderOverride(ai);
});

afterAll(async () => {
  setAIProviderOverride(null);
  const users = await prisma.user.findMany({
    where: { email: { in: [emailA, emailB] } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.agentToolCall.deleteMany({ where: { session: { userId: { in: ids } } } });
    await prisma.agentMessage.deleteMany({ where: { session: { userId: { in: ids } } } });
    await prisma.agentSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: ids } } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: ids } } } });
    await prisma.order.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userPreference.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.product.deleteMany({ where: { merchantId } });
  await prisma.productCategory.deleteMany({ where: { slug: catSlug } });
  await prisma.merchant.deleteMany({ where: { email: merchantEmail } });
  await prisma.$disconnect();
});

describe('Frontend contract — chat session APIs', () => {
  it('lists sessions latest-first, isolates users, serves messages and activity', async () => {
    const s1 = await authA(request(app).post('/api/v1/agent/sessions').send({}));
    const s2 = await authA(request(app).post('/api/v1/agent/sessions').send({}));
    expect(s1.status).toBe(201);

    ai.queue.push({ text: 'Hi there.', toolCalls: [] });
    await authA(
      request(app).post(`/api/v1/agent/sessions/${s1.body.session.id}/messages`).send({ message: 'Hello' }),
    );

    const list = await authA(request(app).get('/api/v1/agent/sessions'));
    expect(list.status).toBe(200);
    expect(list.body.success).toBe(true);
    expect(list.body.data.map((s: { id: string }) => s.id)).toContain(s1.body.session.id);
    expect(list.body.data[0].messageCount).toBeGreaterThanOrEqual(0);
    expect((await authB(request(app).get('/api/v1/agent/sessions'))).body.data).toEqual([]);

    const messages = await authA(
      request(app).get(`/api/v1/agent/sessions/${s1.body.session.id}/messages`),
    );
    expect(messages.body.data.map((m: { role: string }) => m.role)).toEqual(['USER', 'ASSISTANT']);
    expect((await authB(request(app).get(`/api/v1/agent/sessions/${s1.body.session.id}/messages`))).status).toBe(404);

    const activity = await authA(
      request(app).get(`/api/v1/agent/sessions/${s2.body.session.id}/activity`),
    );
    expect(activity.status).toBe(200);
    expect(activity.body.data[0]).toMatchObject({ type: 'complete' });
    expect((await authB(request(app).get(`/api/v1/agent/sessions/${s2.body.session.id}/activity`))).status).toBe(404);
  });
});

describe('Frontend contract — AgentResponse shape', () => {
  it('returns type, products, grounded recommendation, activities, and actions', async () => {
    const session = await authA(request(app).post('/api/v1/agent/sessions').send({}));
    const id = session.body.session.id as string;
    ai.queue.push(
      { text: 'Searching.', toolCalls: [{ name: 'search_products', args: { query: 'Fx2Test' } }] },
      { text: 'Found a great option.', toolCalls: [] },
    );
    const res = await authA(
      request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: 'Find headphones' }),
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sessionId: id, type: 'product_recommendation' });
    expect(typeof res.body.messageId).toBe('string');
    expect(res.body.products[0]).toMatchObject({ name: `Fx2Test Headphone ${stamp}`, price: 4000 });
    expect(res.body.products[0].stockStatus).toBe('in_stock');
    expect(res.body.recommendation.productId).toBe(res.body.products[0].id);
    expect(res.body.recommendation.reason).toContain('4,000');
    expect(res.body.recommendation.matchedPreferences.join(' ')).toContain('5,000');
    const labels = res.body.activities.map((a: { label: string }) => a.label).join(' | ');
    expect(labels).not.toContain('search_products');
    expect(labels).toContain('Searching products');
    expect(res.body.actions).toContainEqual(
      expect.objectContaining({ type: 'add_to_cart', productId: res.body.products[0].id }),
    );

    const activity = await authA(request(app).get(`/api/v1/agent/sessions/${id}/activity`));
    expect(activity.body.data.some((a: { type: string }) => a.type === 'search')).toBe(true);
  });

  it('exposes cart snapshots and get_cart through the agent', async () => {
    const session = await authA(request(app).post('/api/v1/agent/sessions').send({}));
    const id = session.body.session.id as string;
    ai.queue.push(
      { text: 'Adding.', toolCalls: [{ name: 'add_to_cart', args: { product_id: prodId, quantity: 1 } }] },
      { text: 'Added.', toolCalls: [] },
    );
    const res = await authA(
      request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: 'Add it' }),
    );
    expect(res.body.type).toBe('cart_update');
    expect(res.body.cart.pricing.total).toBe(4000);

    ai.queue.push(
      { text: 'Reading cart.', toolCalls: [{ name: 'get_cart', args: {} }] },
      { text: 'Here is your cart.', toolCalls: [] },
    );
    const res2 = await authA(
      request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: 'Show my cart' }),
    );
    expect(res2.body.cart.items).toHaveLength(1);
  });

  it('returns order preview data with security checks through the agent', async () => {
    const session = await authA(request(app).post('/api/v1/agent/sessions').send({}));
    const id = session.body.session.id as string;
    ai.queue.push(
      { text: 'Previewing.', toolCalls: [{ name: 'preview_order', args: {} }] },
      { text: 'Total is 4000.', toolCalls: [] },
    );
    const res = await authA(
      request(app).post(`/api/v1/agent/sessions/${id}/messages`).send({ message: 'How much?' }),
    );
    expect(res.body.type).toBe('order_preview');
    expect(res.body.order.pricing.total).toBe(4000);
    expect(res.body.securityChecks).toMatchObject({ priceVerified: true, userConfirmationRequired: true });
    expect(res.body.actions).toContainEqual(expect.objectContaining({ type: 'checkout' }));
  });
});
