import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();
// Unique per file-load AND per run: parallel test files may share a millisecond.
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const catSlug = `p5test-cat-${stamp}`;
const merchantEmail = `p5test.merchant.${stamp}@example.com`;
const emailA = `p5test.a.${stamp}@example.com`;
const emailB = `p5test.b.${stamp}@example.com`;
const password = 'secure-password-1';

let tokenA = '';
let tokenB = '';
let merchantId = '';
let prodA = '';
let prodB = '';
let prodCheap = '';
let prodLow = '';

async function register(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'P5Test', email, password });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

const authA = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
const authB = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);

async function resetCart(token: string): Promise<void> {
  await request(app).delete('/api/v1/cart').set('Authorization', `Bearer ${token}`);
}

async function add(token: string, productId: string, quantity: number) {
  return request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId, quantity });
}

beforeAll(async () => {
  tokenA = await register(emailA);
  tokenB = await register(emailB);

  const merchant = await prisma.merchant.create({
    data: { name: 'P5Test Merchant', email: merchantEmail, status: 'ACTIVE' },
  });
  merchantId = merchant.id;
  const category = await prisma.productCategory.create({
    data: { name: 'P5Test Category', slug: catSlug },
  });
  const mk = (suffix: string, price: number, stock: number) =>
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        categoryId: category.id,
        name: `P5Test Product ${suffix} ${stamp}`,
        slug: `p5test-product-${suffix.toLowerCase()}-${stamp}`,
        description: 'P5Test fixture',
        price,
        currency: 'INR',
        stockQuantity: stock,
        status: 'ACTIVE',
      },
    });
  prodA = (await mk('A', 1000, 10)).id;
  prodB = (await mk('B', 300, 10)).id;
  prodCheap = (await mk('Cheap', 100, 10)).id;
  prodLow = (await mk('Low', 500, 1)).id;
});

afterAll(async () => {
  // FK-safe teardown: Order.user is Restrict (financial history), so delete
  // line items + orders before users.
  const users = await prisma.user.findMany({
    where: { email: { in: [emailA, emailB] } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: ids } } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: ids } } } });
    await prisma.order.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  // Exact merchantId match: never touches other files' fixtures even if
  // parallel files share a timestamp-based stamp.
  await prisma.product.deleteMany({ where: { merchantId } });
  await prisma.productCategory.deleteMany({ where: { slug: catSlug } });
  await prisma.merchant.deleteMany({ where: { email: merchantEmail } });
  await prisma.$disconnect();
});

describe('Phase 5 — POST /api/v1/orders/preview', () => {
  it('rejects unauthenticated access and empty carts', async () => {
    expect((await request(app).post('/api/v1/orders/preview')).status).toBe(401);
    await resetCart(tokenA);
    const res = await authA(request(app).post('/api/v1/orders/preview'));
    expect(res.status).toBe(400);
  });

  it('prices from current DB prices, not cart snapshots or client input', async () => {
    await resetCart(tokenA);
    await add(tokenA, prodA, 2);
    await prisma.product.update({ where: { id: prodA }, data: { price: 1200 } });
    try {
      const res = await authA(
        request(app).post('/api/v1/orders/preview').send({ total: 1, items: [] }),
      );
      expect(res.status).toBe(200);
      expect(res.body.subtotal).toBe(2400);
      expect(res.body.items[0].unitPrice).toBe(1200);
    } finally {
      await prisma.product.update({ where: { id: prodA }, data: { price: 1000 } });
    }
  });

  it('computes subtotal + shipping + total authoritatively', async () => {
    await resetCart(tokenA);
    await add(tokenA, prodA, 2);
    await add(tokenA, prodB, 1);
    const res = await authA(request(app).post('/api/v1/orders/preview'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      subtotal: 2300,
      shipping: 0,
      discount: 0,
      total: 2300,
      currency: 'INR',
    });
    expect(res.body.items).toHaveLength(2);
  });

  it('applies flat shipping below the free-shipping threshold', async () => {
    await resetCart(tokenA);
    await add(tokenA, prodCheap, 1);
    const res = await authA(request(app).post('/api/v1/orders/preview'));
    expect(res.body).toMatchObject({ subtotal: 100, shipping: 49, total: 149 });
  });

  it('rejects preview when stock is insufficient', async () => {
    await resetCart(tokenA);
    await add(tokenA, prodLow, 1);
    await prisma.product.update({ where: { id: prodLow }, data: { stockQuantity: 0 } });
    try {
      const res = await authA(request(app).post('/api/v1/orders/preview'));
      expect(res.status).toBe(409);
    } finally {
      await prisma.product.update({ where: { id: prodLow }, data: { stockQuantity: 1 } });
    }
  });
});

describe('Phase 5 — POST /api/v1/orders', () => {
  it('creates a PENDING_PAYMENT order, decrements stock, checks out the cart', async () => {
    await resetCart(tokenA);
    await add(tokenA, prodA, 2);
    await add(tokenA, prodB, 1);

    const res = await authA(request(app).post('/api/v1/orders'));
    expect(res.status).toBe(201);
    const order = res.body.order;
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.orderNumber).toMatch(/^RP-/);
    expect(order).toMatchObject({ subtotal: 2300, shipping: 0, total: 2300, currency: 'INR' });
    expect(order.items).toHaveLength(2);
    expect(order.payments).toEqual([]);

    const stock = await prisma.product.findUniqueOrThrow({ where: { id: prodA } });
    expect(stock.stockQuantity).toBe(8);

    const cart = await authA(request(app).get('/api/v1/cart'));
    expect(cart.body.cart.items).toEqual([]);
  });

  it('rejects creation from an empty cart', async () => {
    const res = await authA(request(app).post('/api/v1/orders'));
    expect(res.status).toBe(400);
  });

  it('rolls back when stock is insufficient (no order created)', async () => {
    await resetCart(tokenA);
    await add(tokenA, prodLow, 1);
    await prisma.product.update({ where: { id: prodLow }, data: { stockQuantity: 0 } });
    const before = await prisma.order.count({ where: { userId: (await prisma.user.findUniqueOrThrow({ where: { email: emailA } })).id } });
    try {
      const res = await authA(request(app).post('/api/v1/orders'));
      expect(res.status).toBe(409);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: emailA } });
      expect(await prisma.order.count({ where: { userId: user.id } })).toBe(before);
    } finally {
      await prisma.product.update({ where: { id: prodLow }, data: { stockQuantity: 1 } });
      await resetCart(tokenA);
    }
  });

  it('is idempotent for the same Idempotency-Key', async () => {
    await resetCart(tokenB);
    await add(tokenB, prodB, 1);
    const key = `p5test-key-${stamp}`;
    const first = await authB(request(app).post('/api/v1/orders').set('Idempotency-Key', key));
    expect(first.status).toBe(201);
    const second = await authB(request(app).post('/api/v1/orders').set('Idempotency-Key', key));
    expect(second.status).toBe(200);
    expect(second.body.order.id).toBe(first.body.order.id);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: emailB } });
    expect(
      await prisma.order.count({ where: { userId: user.id, idempotencyKey: key } }),
    ).toBe(1);
  });
});

describe('Phase 5 — GET /api/v1/orders', () => {
  it('lists own orders, isolates other users, validates ids', async () => {
    const mine = await authA(request(app).get('/api/v1/orders'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBeGreaterThanOrEqual(1);
    const id = mine.body.data[0].id as string;

    const one = await authA(request(app).get(`/api/v1/orders/${id}`));
    expect(one.status).toBe(200);
    expect(one.body.order.id).toBe(id);

    expect((await authB(request(app).get(`/api/v1/orders/${id}`))).status).toBe(404);
    expect(
      (await authA(request(app).get('/api/v1/orders/00000000-0000-0000-0000-000000000000'))).status,
    ).toBe(404);
    expect((await authA(request(app).get('/api/v1/orders/nope'))).status).toBe(400);
    expect((await request(app).get('/api/v1/orders')).status).toBe(401);
  });
});
