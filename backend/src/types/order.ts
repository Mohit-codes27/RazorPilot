import type { PricingBreakdown } from './cart.js';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'PAYMENT_FAILED';

export interface OrderItemResponse {
  id: string;
  productId: string | null;
  productName: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  stockVerified?: boolean;
}

export interface OrderPaymentSummary {
  status: 'CREATED' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  provider: 'razorpay' | 'simulator';
}

export interface OrderTimelineEvent {
  id: string;
  type:
    | 'ORDER_CREATED'
    | 'PAYMENT_INITIATED'
    | 'PAYMENT_VERIFIED'
    | 'ORDER_CONFIRMED'
    | 'PROCESSING'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'PAYMENT_FAILED';
  title: string;
  description?: string;
  status: 'completed' | 'current' | 'pending';
  timestamp: string;
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItemResponse[];
  pricing: PricingBreakdown;
  payment?: OrderPaymentSummary;
  timeline: OrderTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: string;
  itemCount: number;
  total: number;
  currency: string;
  previewImageUrl?: string | null;
  createdAt: string;
}

export interface SecurityChecks {
  priceVerified: boolean;
  stockVerified: boolean;
  totalVerified: boolean;
  userConfirmationRequired: boolean;
}

export interface OrderPreviewItem {
  productId: string;
  name: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  stockVerified: boolean;
}

export interface OrderPreviewResponse {
  items: OrderPreviewItem[];
  pricing: PricingBreakdown;
  securityChecks: SecurityChecks;
  requiresUserConfirmation: true;
}
