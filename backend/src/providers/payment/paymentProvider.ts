export interface CreatePaymentOrderInput {
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
}

export interface PaymentOrder {
  providerOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface VerificationResult {
  verified: boolean;
  reason?: string;
  method?: string;
}

export type ProviderPaymentStatus = 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'UNKNOWN';

export interface RefundResult {
  refundId: string;
  amount: number;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentOrder(input: CreatePaymentOrderInput): Promise<PaymentOrder>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerificationResult>;
  getPaymentStatus(providerPaymentId: string): Promise<ProviderPaymentStatus>;
  refundPayment(providerPaymentId: string, amount: number): Promise<RefundResult>;
}
