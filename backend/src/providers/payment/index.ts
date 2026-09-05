import { env } from '../../config/env.js';
import type { PaymentProvider } from './paymentProvider.js';
import { RazorpayProvider } from './razorpay.provider.js';
import { SimulatorPaymentProvider } from './simulator.provider.js';

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  cached = env.PAYMENT_PROVIDER === 'razorpay' ? new RazorpayProvider() : new SimulatorPaymentProvider();
  return cached;
}

/** Test-only reset for the provider singleton. */
export function resetPaymentProvider(): void {
  cached = null;
}
