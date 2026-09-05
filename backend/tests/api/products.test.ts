import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

const app = createApp();
const stamp = `${Date.now()}`;
const catSlug = `p3test-cat-${stamp}`;
const merchantEmail = `p3test.merchant.${stamp}@example.com`;

let merchantId = '';
let prodActiveId = '';
let prodOosId = '';
let prodInactiveId = '';

beforeAll(async () => {
  const merchant = await prisma.merchant.create({
    data: { name: 'P3Test Merchant', email: merchantEmail, status: 'ACTIVE' },
  });
  merchantId = merchant.id;
  const category = await prisma.productCategory.create({
    data: { name: 'P3Test Category', slug: catSlug },
  });

  const mk = (suffix: string, price: number, stock: number, status: string) =>
    prisma.product.create({
      data: {
        merchantId,
        categoryId: category.id,
        name: `P3Test Product ${suffix} ${stamp}`,
        slug: `p3test-product-${suffix.toLowerCase()}-${stamp}`,
        description: `P3Test unique description ${suffix} ${stamp}`,
        price,
        currency: 'INR',
        stockQuantity: stock,
        status,
        attributes: { p3test: true },
      },
    });

  prodActiveId = (await mk('Active', 4500, 10, 'ACTIVE')).id;
  prodOosId = (await mk('OutOfStock', 800, 0, 'OUT_OF_STOCK')).id;
  prodInactiveId = (await mk('Hidden', 1500, 5, 'INACTIVE')).id;
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { merchantId } });
  await prisma.productCategory.deleteMany({ where: { slug: catSlug } });
  await prisma.merchant.deleteMany({ where: { email: merchantEmail } });
  await prisma.$disconnect();
});

describe('Phase 3 — GET /api/v1/products', () => {
  it('lists visible products with pagination envelope (public, no auth)', async () => {
    const res = await request(app).get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 20 });
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    const ids = res.body.data.map((p: { id: string }) => p.id);
    expect(ids).toContain(prodActiveId);
    expect(ids).not.toContain(prodInactiveId);
    expect(typeof res.body.data[0].price).toBe('number');
  });

  it('paginates with pageSize=1', async () => {
    const p1 = await request(app).get('/api/v1/products').query({ pageSize: 1, page: 1 });
    const p2 = await request(app).get('/api/v1/products').query({ pageSize: 1, page: 2 });
    expect(p1.body.data).toHaveLength(1);
    expect(p2.body.data).toHaveLength(1);
    expect(p1.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
  });

  it('rejects pageSize above 50', async () => {
    const res = await request(app).get('/api/v1/products').query({ pageSize: 100 });
    expect(res.status).toBe(400);
  });

  it('filters by category slug', async () => {
    const res = await request(app).get('/api/v1/products').query({ category: catSlug });
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(2);
    for (const p of res.body.data) expect(p.category.slug).toBe(catSlug);
  });

  it('filters by merchant and price range', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .query({ merchant: merchantId, minPrice: 1000, maxPrice: 5000 });
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.data[0].id).toBe(prodActiveId);
  });

  it('filters by availability', async () => {
    const inStock = await request(app).get('/api/v1/products').query({ category: catSlug, availability: 'in_stock' });
    expect(inStock.body.pagination.total).toBe(1);
    expect(inStock.body.data[0].id).toBe(prodActiveId);

    const oos = await request(app).get('/api/v1/products').query({ category: catSlug, availability: 'out_of_stock' });
    expect(oos.body.pagination.total).toBe(1);
    expect(oos.body.data[0].id).toBe(prodOosId);
  });

  it('rejects invalid merchant id', async () => {
    const res = await request(app).get('/api/v1/products').query({ merchant: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });
});

describe('Phase 3 — GET /api/v1/products/search', () => {
  it('finds products by query text', async () => {
    const res = await request(app).get('/api/v1/products/search').query({ q: `P3Test unique description Active ${stamp}` });
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { id: string }) => p.id)).toContain(prodActiveId);
  });

  it('requires q', async () => {
    const res = await request(app).get('/api/v1/products/search');
    expect(res.status).toBe(400);
  });

  it('combines q with price filter', async () => {
    const res = await request(app)
      .get('/api/v1/products/search')
      .query({ q: 'P3Test Product', minPrice: 4000 });
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { id: string }) => p.id)).toContain(prodActiveId);
    expect(res.body.data.map((p: { id: string }) => p.id)).not.toContain(prodOosId);
  });
});

describe('Phase 3 — GET /api/v1/products/:id', () => {
  it('returns product details with category and merchant', async () => {
    const res = await request(app).get(`/api/v1/products/${prodActiveId}`);
    expect(res.status).toBe(200);
    expect(res.body.product.id).toBe(prodActiveId);
    expect(res.body.product.merchant.name).toBe('P3Test Merchant');
    expect(res.body.product.category.slug).toBe(catSlug);
  });

  it('rejects malformed id with 400', async () => {
    const res = await request(app).get('/api/v1/products/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/v1/products/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('returns 404 for INACTIVE product', async () => {
    const res = await request(app).get(`/api/v1/products/${prodInactiveId}`);
    expect(res.status).toBe(404);
  });
});

describe('Phase 3 — GET /api/v1/categories', () => {
  it('lists categories with product counts', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(200);
    const found = res.body.data.find((c: { slug: string }) => c.slug === catSlug);
    expect(found).toBeDefined();
    expect(found.productCount).toBe(2);
  });
});
