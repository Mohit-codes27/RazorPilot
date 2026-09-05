import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { listProductsSchema, searchProductsSchema } from '../../src/modules/products/product.schemas.js';
import { toProductDTO } from '../../src/modules/products/product.service.js';

describe('Phase 3 — product query schemas', () => {
  it('applies pagination defaults and clamps pageSize to 50', () => {
    const parsed = listProductsSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(() => listProductsSchema.parse({ pageSize: 100 })).toThrow();
    expect(() => listProductsSchema.parse({ minPrice: -5 })).toThrow();
  });

  it('requires q for search', () => {
    expect(() => searchProductsSchema.parse({})).toThrow();
    expect(searchProductsSchema.parse({ q: 'headphones' }).q).toBe('headphones');
  });
});

describe('Phase 3 — product DTO', () => {
  it('serializes Decimal price to number', () => {
    const dto = toProductDTO({
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Test',
      slug: 'test',
      description: null,
      price: new Prisma.Decimal(4999),
      currency: 'INR',
      stockQuantity: 3,
      status: 'ACTIVE',
      attributes: {},
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: null,
      merchant: { id: '00000000-0000-0000-0000-000000000001', name: 'M' },
    });
    expect(dto.price).toBe(4999);
    expect(typeof dto.price).toBe('number');
  });
});
