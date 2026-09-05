import type { OrderResponse } from './order.js';

export interface PaymentInitializationResponse {
  orderId: string;
  razorpayOrderId: string;
  /** Smallest currency unit (paise for INR). */
  amountPaise: number;
  /** Major unit (rupees for INR). */
  amountRupees: number;
  currency: string;
  /** Publishable key only — never the secret. */
  razorpayKeyId: string;
  paymentStatus: 'created' | 'pending';
  requiresUserConfirmation: boolean;
}

export interface PaymentRecordData {
  id: string;
  orderId: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
  method?: string | null;
}

export interface PaymentVerificationResponse {
  success: boolean;
  order: OrderResponse;
  payment: PaymentRecordData;
  status: 'PAID' | 'FAILED' | 'PENDING';
  message: string;
}
