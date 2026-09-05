import { describe, expect, it } from 'vitest';
import {
  computeShipping,
  FREE_SHIPPING_THRESHOLD,
  generateOrderNumber,
  SHIPPING_FLAT_FEE,
} from '../../src/modules/orders/order.service.js';

describe('Phase 5 — pricing rules', () => {
  it('charges flat shipping below threshold, free at/above', () => {
    expect(computeShipping(FREE_SHIPPING_THRESHOLD - 1)).toBe(SHIPPING_FLAT_FEE);
    expect(computeShipping(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(computeShipping(100000)).toBe(0);
  });

  it('generates unique RP-prefixed order numbers', () => {
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    expect(a).toMatch(/^RP-/);
    expect(a).not.toBe(b);
  });
});
