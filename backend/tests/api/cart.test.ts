import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();
// Unique per file-load AND per run: parallel test files may share a millisecond.
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const catSlug = `p4test-cat-${stamp}`;
const merchantEmail = `p4test.merchant.${stamp}@example.com`;
const emailA = `p4test.a.${stamp}@example.com`;
const emailB = `p4test.b.${stamp}@example.com`;
const password = 'secure-password-1';

let tokenA = '';
let tokenB = '';
let merchantId = '';
let prodActiveId = '';
let prodOosId = '';
let prodInactiveId = '';

async function register(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'P4Test', email, password });
  expect(res.status).toBe(201);
  return res.body.token as string;
}

beforeAll(async () => {
  tokenA = await register(emailA);
  tokenB = await register(emailB);

  const merchant = await prisma.merchant.create({
    data: { name: 'P4Test Merchant', email: merchantEmail, status: 'ACTIVE' },
  });
  merchantId = merchant.id;
  const category = await prisma.productCategory.create({
    data: { name: 'P4Test Category', slug: catSlug },
  });
  const mk = (suffix: string, price: number, stock: number, status: string) =>
    prisma.product.create({
      data: {
        merchantId: merchant.id,
        categoryId: category.id,
        name: `P4Test Product ${suffix} ${stamp}`,
        slug: `p4test-product-${suffix.toLowerCase()}-${stamp}`,
        description: 'P4Test fixture',
        price,
        currency: 'INR',
        stockQuantity: stock,
        status,
      },
    });
  prodActiveId = (await mk('Active', 1000, 5, 'ACTIVE')).id;
  prodOosId = (await mk('Oos', 500, 0, 'OUT_OF_STOCK')).id;
  prodInactiveId = (await mk('Hidden', 700, 5, 'INACTIVE')).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
  // Exact merchantId match: never touches other files' fixtures even if
  // parallel files share a timestamp-based stamp.
  await prisma.product.deleteMany({ where: { merchantId } });
  await prisma.productCategory.deleteMany({ where: { slug: catSlug } });
  await prisma.merchant.deleteMany({ where: { email: merchantEmail } });
  await prisma.$disconnect();
});

const authA = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
const authB = (r: request.Test) => r.set('Authorization', `Bearer ${tokenB}`);

describe('Phase 4 — GET /api/v1/cart', () => {
  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/v1/cart');
    expect(res.status).toBe(401);
  });

  it('auto-creates an empty cart', async () => {
    const res = await authA(request(app).get('/api/v1/cart'));
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
    expect(res.body.cart.subtotal).toBe(0);
  });
});

describe('Phase 4 — POST /api/v1/cart/items', () => {
  it('adds an item at the authoritative DB price (ignores client price)', async () => {
    const res = await authA(
      request(app).post('/api/v1/cart/items').send({ productId: prodActiveId, quantity: 2, unitPrice: 1 }),
    );
    expect(res.status).toBe(200);
    const item = res.body.cart.items[0];
    expect(item.quantity).toBe(2);
    expect(item.unitPrice).toBe(1000);
    expect(item.lineTotal).toBe(2000);
    expect(res.body.cart.subtotal).toBe(2000);
  });

  it('increments quantity when the same product is added again', async () => {
    const res = await authA(
      request(app).post('/api/v1/cart/items').send({ productId: prodActiveId, quantity: 1 }),
    );
    expect(res.body.cart.items[0].quantity).toBe(3);
  });

  it('rejects quantity exceeding stock with 409', async () => {
    const res = await authA(
      request(app).post('/api/v1/cart/items').send({ productId: prodActiveId, quantity: 3 }),
    );
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRODUCT_OUT_OF_STOCK');
  });

  it('rejects unknown product with 404 and malformed id with 400', async () => {
    const nf = await authA(
      request(app)
        .post('/api/v1/cart/items')
        .send({ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }),
    );
    expect(nf.status).toBe(404);

    const bad = await authA(
      request(app).post('/api/v1/cart/items').send({ productId: 'nope', quantity: 1 }),
    );
    expect(bad.status).toBe(400);
  });

  it('rejects zero quantity with 400', async () => {
    const res = await authA(
      request(app).post('/api/v1/cart/items').send({ productId: prodActiveId, quantity: 0 }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects out-of-stock product with 409 and inactive with 404', async () => {
    const oos = await authA(
      request(app).post('/api/v1/cart/items').send({ productId: prodOosId, quantity: 1 }),
    );
    expect(oos.status).toBe(409);

    const hidden = await authA(
      request(app).post('/api/v1/cart/items').send({ productId: prodInactiveId, quantity: 1 }),
    );
    expect(hidden.status).toBe(404);
  });
});

describe('Phase 4 — PATCH /api/v1/cart/items/:id', () => {
  let itemId = '';

  it('updates quantity and refreshes unit price from DB', async () => {
    const cart = await authA(request(app).get('/api/v1/cart'));
    itemId = cart.body.cart.items[0].id as string;

    await prisma.product.update({ where: { id: prodActiveId }, data: { price: 1200 } });
    const res = await authA(
      request(app).patch(`/api/v1/cart/items/${itemId}`).send({ quantity: 1 }),
    );
    expect(res.status).toBe(200);
    expect(res.body.cart.items[0].quantity).toBe(1);
    expect(res.body.cart.items[0].unitPrice).toBe(1200);
    await prisma.product.update({ where: { id: prodActiveId }, data: { price: 1000 } });
  });

  it('rejects quantity exceeding stock', async () => {
    const res = await authA(
      request(app).patch(`/api/v1/cart/items/${itemId}`).send({ quantity: 99 }),
    );
    expect(res.status).toBe(409);
  });

  it('returns 404 for unknown item and 400 for malformed id', async () => {
    const nf = await authA(
      request(app)
        .patch('/api/v1/cart/items/00000000-0000-0000-0000-000000000000')
        .send({ quantity: 1 }),
    );
    expect(nf.status).toBe(404);

    const bad = await authA(request(app).patch('/api/v1/cart/items/nope').send({ quantity: 1 }));
    expect(bad.status).toBe(400);
  });

  it('blocks cross-user access with 404', async () => {
    const res = await authB(
      request(app).patch(`/api/v1/cart/items/${itemId}`).send({ quantity: 1 }),
    );
    expect(res.status).toBe(404);

    const otherCart = await authB(request(app).get('/api/v1/cart'));
    expect(otherCart.body.cart.items).toEqual([]);
  });
});

describe('Phase 4 — DELETE /api/v1/cart/items/:id and /api/v1/cart', () => {
  it('blocks cross-user delete, then removes the item', async () => {
    const cart = await authA(request(app).get('/api/v1/cart'));
    const itemId = cart.body.cart.items[0].id as string;

    const blocked = await authB(request(app).delete(`/api/v1/cart/items/${itemId}`));
    expect(blocked.status).toBe(404);

    const res = await authA(request(app).delete(`/api/v1/cart/items/${itemId}`));
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);

    const again = await authA(request(app).delete(`/api/v1/cart/items/${itemId}`));
    expect(again.status).toBe(404);
  });

  it('clears the whole cart', async () => {
    await authA(request(app).post('/api/v1/cart/items').send({ productId: prodActiveId, quantity: 2 }));
    const before = await authA(request(app).get('/api/v1/cart'));
    expect(before.body.cart.items).toHaveLength(1);

    const res = await authA(request(app).delete('/api/v1/cart'));
    expect(res.status).toBe(200);
    expect(res.body.cart.items).toEqual([]);
    expect(res.body.cart.subtotal).toBe(0);
  });
});
