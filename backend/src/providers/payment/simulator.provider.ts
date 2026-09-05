import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { ProviderError } from '../../utils/errors.js';
import type {
  CreatePaymentOrderInput,
  PaymentProvider,
  PaymentOrder,
  ProviderPaymentStatus,
  RefundResult,
  VerificationResult,
  VerifyPaymentInput,
} from './paymentProvider.js';

/**
 * Deterministic demo provider (PAYMENT_PROVIDER=simulator). Never for production.
 *
 * Outcome is driven by the payment id so tests stay deterministic without
 * mutating environment:
 * - providerPaymentId starting with `pay_fail` → provider reports FAILURE
 * - providerPaymentId starting with `pay_timeout` → provider TIMES OUT (throws)
 * - anything else + valid signature → SUCCESS
 */
export const SIMULATOR_SECRET = 'simulator-local-only-secret';

export function simulatorSignature(providerOrderId: string, providerPaymentId: string): string {
  return createHmac('sha256', SIMULATOR_SECRET)
    .update(`${providerOrderId}|${providerPaymentId}`)
    .digest('hex');
}

function signatureMatches(orderId: string, paymentId: string, signature: string): boolean {
  const expected = simulatorSignature(orderId, paymentId);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export class SimulatorPaymentProvider implements PaymentProvider {
  readonly name = 'simulator';

  async createPaymentOrder(input: CreatePaymentOrderInput): Promise<PaymentOrder> {
    return {
      providerOrderId: `order_sim_${randomBytes(8).toString('hex')}`,
      amount: input.amount,
      currency: input.currency,
      keyId: 'simulator',
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerificationResult> {
    if (!signatureMatches(input.providerOrderId, input.providerPaymentId, input.signature)) {
      return { verified: false, reason: 'invalid_signature' };
    }
    if (input.providerPaymentId.startsWith('pay_timeout')) {
      // Deterministic TIMEOUT demo: the provider never answers. The service
      // leaves payment + order open so the user can safely retry.
      throw new ProviderError('simulated provider timeout');
    }
    if (input.providerPaymentId.startsWith('pay_fail')) {
      return { verified: false, reason: 'payment_failed' };
    }
    return { verified: true, method: 'upi' };
  }

  async getPaymentStatus(_providerPaymentId: string): Promise<ProviderPaymentStatus> {
    return 'CREATED';
  }

  async refundPayment(providerPaymentId: string, amount: number): Promise<RefundResult> {
    if (!providerPaymentId) throw new ProviderError('simulated refund failed: unknown payment');
    return { refundId: `refund_sim_${randomBytes(8).toString('hex')}`, amount };
  }
}
