import type { ProductCardData } from './product.js';

export interface PricingBreakdown {
  subtotal: number;
  discount: number;
  shipping: number;
  tax?: number;
  total: number;
  currency: string;
}

export interface CartItemResponse {
  id: string;
  product: ProductCardData;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CartResponse {
  id: string;
  items: CartItemResponse[];
  itemCount: number;
  pricing: PricingBreakdown;
  updatedAt: string;
}
