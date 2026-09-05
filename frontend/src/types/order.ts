import type { Pricing } from "./cart";

export interface OrderTimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: "completed" | "current" | "pending";
  timestamp: string;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  productName: string;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  stockVerified?: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  pricing: Pricing;
  currency: string;
  items: OrderItem[];
  payments: Array<{ id: string; provider: string; status: string; amount: number; currency: string }>;
  payment?: { status: string; provider: string };
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

export interface OrderPreview {
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  pricing: Pricing;
  securityChecks: {
    priceVerified: boolean;
    stockVerified: boolean;
    totalVerified: boolean;
    userConfirmationRequired: boolean;
  };
  requiresUserConfirmation: boolean;
}

export interface CheckoutData {
  keyId: string;
  razorpayKeyId: string;
  providerOrderId: string;
  razorpayOrderId: string;
  amount: number;
  amountRupees: number;
  amountPaise: number;
  currency: string;
  orderId: string;
  orderNumber: string;
  paymentStatus: string;
  requiresUserConfirmation: boolean;
}

export interface Payment {
  id: string;
  orderId: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
}
