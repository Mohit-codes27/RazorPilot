import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const catSlug = `mctest-cat-${stamp}`;
const emailM1 = `mctest.m1.${stamp}@example.com`;
const emailM2 = `mctest.m2.${stamp}@example.com`;
const emailU = `mctest.u.${stamp}@example.com`;
const password = 'secure-password-1';

let tokenM1 = '';
let tokenM2 = '';
let tokenU = '';
let merchantId1 = '';
let categoryId = '';

async function registerMerchant(email: string): Promise<{ token: string; id: string }> {
  const res = await request(app)
    .post('/api/v1/merchants/register')
    .send({ name: 'McTest Merchant', email, password });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, id: res.body.merchant.id as string };
}

const authM1 = (r: request.Test) => r.set('Authorization', `Bearer ${tokenM1}`);
const authM2 = (r: request.Test) => r.set('Authorization', `Bearer ${tokenM2}`);
const authU = (r: request.Test) => r.set('Authorization', `Bearer ${tokenU}`);

beforeAll(async () => {
  const m1 = await registerMerchant(emailM1);
  tokenM1 = m1.token;
  merchantId1 = m1.id;
  tokenM2 = (await registerMerchant(emailM2)).token;
  const user = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'McTest User', email: emailU, password });
  expect(user.status).toBe(201);
  tokenU = user.body.token as string;
  categoryId = (
    await prisma.productCategory.create({ data: { name: 'McTest Category', slug: catSlug } })
  ).id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: emailU }, select: { id: true } });
  const uids = users.map((u) => u.id);
  if (uids.length > 0) {
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: uids } } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: uids } } } });
    await prisma.order.deleteMany({ where: { userId: { in: uids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
  }
  await prisma.product.deleteMany({ where: { merchantId: merchantId1 } });
  const m2 = await prisma.merchant.findUnique({ where: { email: emailM2 } });
  if (m2) await prisma.product.deleteMany({ where: { merchantId: m2.id } });
  await prisma.productCategory.deleteMany({ where: { slug: catSlug } });
  await prisma.merchant.deleteMany({ where: { email: { in: [emailM1, emailM2] } } });
  await prisma.$disconnect();
});

describe('Merchant auth', () => {
  it('registers, rejects duplicates and bad input', async () => {
    expect(
      (await request(app).post('/api/v1/merchants/register').send({ name: 'Dup', email: emailM1, password })).status,
    ).toBe(409);
    expect(
      (await request(app).post('/api/v1/merchants/register').send({ name: 'Bad', email: 'nope', password })).status,
    ).toBe(400);
  });

  it('logs in, rejects wrong password, serves me', async () => {
    const login = await request(app)
      .post('/api/v1/merchants/login')
      .send({ email: emailM1, password });
    expect(login.status).toBe(200);
    expect(login.body.merchant.email).toBe(emailM1);
    expect(login.body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(login.body)).not.toContain(password);

    expect(
      (await request(app).post('/api/v1/merchants/login').send({ email: emailM1, password: 'wrong-pass-1' })).status,
    ).toBe(401);

    const me = await authM1(request(app).get('/api/v1/merchants/me'));
    expect(me.status).toBe(200);
    expect(me.body.merchant.id).toBe(merchantId1);
  });

  it('isolates user and merchant tokens from each other routes', async () => {
    expect((await authU(request(app).get('/api/v1/merchants/me'))).status).toBe(401);
    expect((await authM1(request(app).get('/api/v1/auth/me'))).status).toBe(401);
    expect((await request(app).get('/api/v1/merchants/me')).status).toBe(401);
  });

  it('blocks suspended merchants', async () => {
    await prisma.merchant.update({ where: { email: emailM1 }, data: { status: 'SUSPENDED' } });
    try {
      expect(
        (await request(app).post('/api/v1/merchants/login').send({ email: emailM1, password })).status,
      ).toBe(403);
      expect((await authM1(request(app).get('/api/v1/merchants/me'))).status).toBe(403);
    } finally {
      await prisma.merchant.update({ where: { email: emailM1 }, data: { status: 'ACTIVE' } });
    }
  });

  it('logs out by clearing the cookie', async () => {
    const res = await request(app).post('/api/v1/merchants/logout');
    expect(res.status).toBe(200);
  });
});

describe('Merchant product catalog', () => {
  let productId = '';

  it('creates products under the own merchant and lists them publicly', async () => {
    const created = await authM1(
      request(app).post('/api/v1/merchants/me/products').send({
        name: `McTest Gizmo ${stamp}`,
        description: 'McTest fixture product',
        categoryId,
        price: 1500,
        stockQuantity: 20,
        attributes: { wireless: true },
      }),
    );
    expect(created.status).toBe(201);
    productId = created.body.product.id as string;
    expect(created.body.product.merchantId).toBe(merchantId1);

    const listed = await authM1(request(app).get('/api/v1/merchants/me/products'));
    expect(listed.body.data.map((p: { id: string }) => p.id)).toContain(productId);

    const pub = await request(app).get(`/api/v1/products/${productId}`);
    expect(pub.status).toBe(200);
    expect(pub.body.product.price).toBe(1500);
  });

  it('updates own products and validates input', async () => {
    const res = await authM1(
      request(app).patch(`/api/v1/merchants/me/products/${productId}`).send({ price: 1800, stockQuantity: 15 }),
    );
    expect(res.status).toBe(200);
    const pub = await request(app).get(`/api/v1/products/${productId}`);
    expect(pub.body.product.price).toBe(1800);

    expect(
      (await authM1(request(app).patch(`/api/v1/merchants/me/products/${productId}`).send({}))).status,
    ).toBe(400);
    expect(
      (await authM1(request(app).patch(`/api/v1/merchants/me/products/${productId}`).send({ price: -5 }))).status,
    ).toBe(400);
  });

  it('blocks cross-merchant product edits with 404', async () => {
    expect(
      (await authM2(request(app).patch(`/api/v1/merchants/me/products/${productId}`).send({ price: 1 }))).status,
    ).toBe(404);
    expect(
      (await authU(request(app).patch(`/api/v1/merchants/me/products/${productId}`).send({ price: 1 }))).status,
    ).toBe(401);
  });
});

describe('Merchant orders and analytics', () => {
  it('sees only own orders and own revenue', async () => {
    const products = await authM1(request(app).get('/api/v1/merchants/me/products'));
    const productId = products.body.data[0].id as string;

    await authU(request(app).delete('/api/v1/cart'));
    await authU(request(app).post('/api/v1/cart/items').send({ productId, quantity: 1 }));
    const order = await authU(request(app).post('/api/v1/orders'));
    expect(order.status).toBe(201);

    const mine = await authM1(request(app).get('/api/v1/merchants/me/orders'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.map((o: { id: string }) => o.id)).toContain(order.body.order.id);

    const other = await authM2(request(app).get('/api/v1/merchants/me/orders'));
    expect(other.body.data).toEqual([]);

    const detail = await authM1(request(app).get(`/api/v1/merchants/me/orders/${order.body.order.id}`));
    expect(detail.status).toBe(200);
    expect(detail.body.order.timeline.length).toBeGreaterThan(0);
    expect((await authM2(request(app).get(`/api/v1/merchants/me/orders/${order.body.order.id}`))).status).toBe(404);

    const analytics = await authM1(request(app).get('/api/v1/analytics/merchant'));
    expect(analytics.status).toBe(200);
    expect(analytics.body.merchantId).toBe(merchantId1);
    expect(analytics.body.totalOrders).toBeGreaterThanOrEqual(1);
    expect((await authU(request(app).get('/api/v1/analytics/merchant'))).status).toBe(401);
  });
});
