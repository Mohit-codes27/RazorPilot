import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../../config/env.js';
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

function signatureMatches(orderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  // process.env first so tests can inject a secret without touching .env.
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';
  private client: Razorpay;

  constructor() {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new ProviderError('Razorpay credentials are not configured');
    }
    this.client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }

  async createPaymentOrder(input: CreatePaymentOrderInput): Promise<PaymentOrder> {
    try {
      const amountPaise = Math.round(input.amount * 100);
      const order = (await this.client.orders.create({
        amount: amountPaise,
        currency: input.currency,
        receipt: input.orderNumber,
      })) as unknown as { id: string; amount: number; currency: string };
      return {
        providerOrderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        keyId: env.RAZORPAY_KEY_ID,
      };
    } catch (err) {
      throw new ProviderError(`Razorpay order creation failed: ${String(err)}`);
    }
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerificationResult> {
    if (!signatureMatches(input.providerOrderId, input.providerPaymentId, input.signature)) {
      return { verified: false, reason: 'invalid_signature' };
    }
    let method: string | undefined;
    try {
      const payment = (await this.client.payments.fetch(input.providerPaymentId)) as unknown as {
        method?: string;
      };
      method = payment.method;
    } catch {
      method = undefined;
    }
    return { verified: true, method };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<ProviderPaymentStatus> {
    try {
      const payment = (await this.client.payments.fetch(providerPaymentId)) as unknown as {
        status: string;
      };
      switch (payment.status) {
        case 'captured':
          return 'CAPTURED';
        case 'authorized':
          return 'AUTHORIZED';
        case 'failed':
          return 'FAILED';
        case 'refunded':
          return 'REFUNDED';
        case 'created':
          return 'CREATED';
        default:
          return 'UNKNOWN';
      }
    } catch (err) {
      throw new ProviderError(`Razorpay status fetch failed: ${String(err)}`);
    }
  }

  async refundPayment(providerPaymentId: string, amount: number): Promise<RefundResult> {
    try {
      const refund = (await this.client.payments.refund(providerPaymentId, {
        amount: Math.round(amount * 100),
        speed: 'normal',
      })) as unknown as { id: string; amount: number };
      return { refundId: refund.id, amount: refund.amount / 100 };
    } catch (err) {
      throw new ProviderError(`Razorpay refund failed: ${String(err)}`);
    }
  }
}

export function newRazorpayOrderIdForTests(): string {
  return `order_${randomBytes(8).toString('hex')}`;
}
