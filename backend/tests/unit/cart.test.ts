import { describe, expect, it } from 'vitest';
import { addItemSchema, updateItemSchema } from '../../src/modules/cart/cart.schemas.js';

describe('Phase 4 — cart schemas', () => {
  it('defaults quantity to 1 and rejects out-of-range quantities', () => {
    expect(
      addItemSchema.parse({ productId: '00000000-0000-0000-0000-000000000000' }).quantity,
    ).toBe(1);
    expect(() =>
      addItemSchema.parse({ productId: '00000000-0000-0000-0000-000000000000', quantity: 0 }),
    ).toThrow();
    expect(() =>
      addItemSchema.parse({ productId: '00000000-0000-0000-0000-000000000000', quantity: 1000 }),
    ).toThrow();
    expect(() => updateItemSchema.parse({ quantity: 0 })).toThrow();
  });

  it('rejects malformed product ids', () => {
    expect(() => addItemSchema.parse({ productId: 'nope', quantity: 1 })).toThrow();
  });
});
