import type { ProductCard } from "./product";

export interface Pricing {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  currency: string;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    currency: string;
    stockQuantity: number;
    status: string;
    imageUrl: string | null;
  };
}

export interface Cart {
  id: string;
  status: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  pricing: Pricing;
  updatedAt: string;
  currency: string;
}

export { type ProductCard };
