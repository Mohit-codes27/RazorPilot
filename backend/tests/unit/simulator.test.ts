import { describe, expect, it } from 'vitest';
import { ProviderError } from '../../src/utils/errors.js';
import {
  SimulatorPaymentProvider,
  simulatorSignature,
} from '../../src/providers/payment/simulator.provider.js';

describe('Phase 10 — simulator deterministic scenarios', () => {
  const provider = new SimulatorPaymentProvider();
  const orderId = 'order_sim_test';

  it('SUCCESS: verifies with valid signature', async () => {
    const paymentId = 'pay_ok_1';
    const result = await provider.verifyPayment({
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      signature: simulatorSignature(orderId, paymentId),
    });
    expect(result).toMatchObject({ verified: true, method: 'upi' });
  });

  it('FAILURE: pay_fail prefix reports failure without throwing', async () => {
    const paymentId = 'pay_fail_card';
    const result = await provider.verifyPayment({
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      signature: simulatorSignature(orderId, paymentId),
    });
    expect(result).toMatchObject({ verified: false, reason: 'payment_failed' });
  });

  it('TIMEOUT: pay_timeout prefix throws a retryable provider error', async () => {
    const paymentId = 'pay_timeout_1';
    await expect(
      provider.verifyPayment({
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        signature: simulatorSignature(orderId, paymentId),
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it('rejects tampered signatures', async () => {
    const result = await provider.verifyPayment({
      providerOrderId: orderId,
      providerPaymentId: 'pay_ok_1',
      signature: 'tampered',
    });
    expect(result).toMatchObject({ verified: false, reason: 'invalid_signature' });
  });

  it('creates deterministic-shaped payment orders', async () => {
    const created = await provider.createPaymentOrder({
      orderId: 'o1',
      orderNumber: 'RP-1',
      amount: 4999,
      currency: 'INR',
    });
    expect(created.providerOrderId).toMatch(/^order_sim_/);
    expect(created).toMatchObject({ amount: 4999, currency: 'INR', keyId: 'simulator' });
  });
});
