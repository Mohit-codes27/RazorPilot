import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { simulatorSignature } from '../../src/providers/payment/simulator.provider.js';

const app = createApp();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const catSlug = `fx1test-cat-${stamp}`;
const merchantEmail = `fx1test.merchant.${stamp}@example.com`;
const email = `fx1test.${stamp}@example.com`;
const password = 'secure-password-1';

let token = '';
let merchantId = '';
let prodHi = '';
let prodLo = '';

const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Fx1Test', email, password });
  expect(reg.status).toBe(201);
  token = reg.body.token as string;

  const merchant = await prisma.merchant.create({
    data: { name: 'Fx1Test Merchant', email: merchantEmail, status: 'ACTIVE' },
  });
  merchantId = merchant.id;
  const category = await prisma.productCategory.create({
    data: { name: 'Fx1Test Category', slug: catSlug },
  });
  const mk = (suffix: string, price: number) =>
    prisma.product.create({
      data: {
        merchantId,
        categoryId: category.id,
        name: `Fx1Test Product ${suffix} ${stamp}`,
        slug: `fx1test-product-${suffix.toLowerCase()}-${stamp}`,
        description: 'Fx1Test fixture',
        price,
        currency: 'INR',
        stockQuantity: 10,
        status: 'ACTIVE',
        attributes: { wireless: true, battery_hours: 50 },
        imageUrl: `https://cdn.razorpilot.local/images/fx1test-${suffix.toLowerCase()}.jpg`,
      },
    });
  prodHi = (await mk('Hi', 2500)).id;
  prodLo = (await mk('Lo', 1000)).id;
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

describe('Frontend contract — success/error envelope', () => {
  it('marks success responses and failures consistently', async () => {
    const okRes = await request(app).get('/api/v1/products').query({ category: catSlug });
    expect(okRes.body.success).toBe(true);

    const bad = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong' });
    expect(bad.status).toBe(401);
    expect(bad.body.success).toBe(false);
    expect(bad.body.error.code).toBe('AUTHENTICATION_ERROR');
  });
});

describe('Frontend contract — product cards and sorting', () => {
  it('returns card fields and honors price_asc sort', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .query({ category: catSlug, sort: 'price_asc' });
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { price: number }) => p.price)).toEqual([1000, 2500]);
    const card = res.body.data[0];
    expect(card.stockStatus).toBe('in_stock');
    expect(Array.isArray(card.keyFeatures)).toBe(true);
    expect(card.keyFeatures.join(' ')).toContain('wireless');
    expect(Array.isArray(card.imageUrls)).toBe(true);
  });
});

describe('Frontend contract — cart pricing object', () => {
  it('returns authoritative pricing breakdown on every mutation', async () => {
    await auth(request(app).delete('/api/v1/cart'));
    const res = await auth(
      request(app).post('/api/v1/cart/items').send({ productId: prodHi, quantity: 2 }),
    );
    expect(res.body.cart.pricing).toMatchObject({
      subtotal: 5000,
      discount: 0,
      shipping: 0,
      total: 5000,
      currency: 'INR',
    });
    expect(typeof res.body.cart.updatedAt).toBe('string');
  });
});

describe('Frontend contract — order preview and PRICE_CHANGED', () => {
  it('returns pricing, security checks, and confirmation flag', async () => {
    const res = await auth(request(app).post('/api/v1/orders/preview').send({}));
    expect(res.status).toBe(200);
    expect(res.body.pricing).toMatchObject({ subtotal: 5000, total: 5000, currency: 'INR' });
    expect(res.body.securityChecks).toMatchObject({
      priceVerified: true,
      stockVerified: true,
      totalVerified: true,
      userConfirmationRequired: true,
    });
    expect(res.body.requiresUserConfirmation).toBe(true);
    expect(res.body.items[0]).toMatchObject({ stockVerified: true });
    expect(typeof res.body.items[0].imageUrl).toBe('string');
  });

  it('returns PRICE_CHANGED with fresh preview on stale expectedTotal', async () => {
    const res = await auth(request(app).post('/api/v1/orders/preview').send({ expectedTotal: 1 }));
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PRICE_CHANGED');
    expect(res.body.error.details.preview.total).toBe(5000);
  });

  it('returns CART_EMPTY code for empty carts', async () => {
    await auth(request(app).delete('/api/v1/cart'));
    await auth(request(app).post('/api/v1/cart/items').send({ productId: prodLo, quantity: 1 }));
    await auth(request(app).delete('/api/v1/cart'));
    const res = await auth(request(app).post('/api/v1/orders/preview').send({}));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });
});

describe('Frontend contract — orders list, detail, timeline, payments', () => {
  let orderId = '';

  it('creates an order then lists it paginated with lightweight items', async () => {
    await auth(request(app).post('/api/v1/cart/items').send({ productId: prodLo, quantity: 1 }));
    const created = await auth(request(app).post('/api/v1/orders'));
    expect(created.status).toBe(201);
    orderId = created.body.order.id as string;

    const list = await auth(request(app).get('/api/v1/orders').query({ pageSize: 1, status: 'PENDING_PAYMENT' }));
    expect(list.status).toBe(200);
    expect(list.body.pagination.total).toBeGreaterThanOrEqual(1);
    expect(list.body.data[0]).toMatchObject({ id: orderId, total: 1000, currency: 'INR' });
    expect(typeof list.body.data[0].orderNumber).toBe('string');
    expect(typeof list.body.data[0].previewImageUrl).toBe('string');
  });

  it('exposes a timeline on order detail that advances after payment', async () => {
    const before = await auth(request(app).get(`/api/v1/orders/${orderId}`));
    const types = before.body.order.timeline.map((t: { type: string }) => t.type);
    expect(types).toContain('ORDER_CREATED');
    expect(before.body.order.timeline[0]).toMatchObject({ status: 'completed' });
    expect(before.body.order.pricing.total).toBe(1000);

    const pay = await auth(request(app).post('/api/v1/payments/create').send({ orderId }));
    expect(pay.body.checkout).toMatchObject({
      amountRupees: 1000,
      amountPaise: 100000,
      currency: 'INR',
      requiresUserConfirmation: true,
    });
    expect(typeof pay.body.checkout.razorpayOrderId).toBe('string');
    expect(pay.body.checkout.razorpayKeyId).toBe('simulator');

    const po = pay.body.checkout.providerOrderId as string;
    const verify = await auth(
      request(app).post('/api/v1/payments/verify').send({
        providerOrderId: po,
        providerPaymentId: 'pay_fx1_ok',
        signature: simulatorSignature(po, 'pay_fx1_ok'),
      }),
    );
    expect(verify.body).toMatchObject({ success: true, status: 'PAID' });
    expect(verify.body.order.status).toBe('PAID');
    expect(verify.body.message).toContain('confirmed');

    const after = await auth(request(app).get(`/api/v1/orders/${orderId}`));
    const timeline = after.body.order.timeline as Array<{ type: string; status: string }>;
    const verified = timeline.find((t) => t.type === 'PAYMENT_VERIFIED');
    const confirmed = timeline.find((t) => t.type === 'ORDER_CONFIRMED');
    expect(verified?.status).toBe('completed');
    expect(confirmed?.status).toBe('completed');
    expect(after.body.order.payment).toMatchObject({ status: 'PAID' });

    const again = await auth(request(app).post('/api/v1/payments/create').send({ orderId }));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ORDER_ALREADY_PAID');
  });

  it('returns INVALID_WEBHOOK_SIGNATURE code for bad webhooks', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'bad')
      .send(JSON.stringify({ id: 'evt_fx1', event: 'payment.captured', payload: {} }));
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });
});
