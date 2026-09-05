/** Frontend-ready product card contract. All fields derive from DB data — never fabricated. */

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export const LOW_STOCK_THRESHOLD = 5;

export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  price: number;
  currency: string;
  originalPrice?: number;
  discountPercentage?: number;
  rating?: number;
  reviewCount?: number;
  stockStatus: StockStatus;
  quantityAvailable?: number;
  category?: { id: string; name: string; slug?: string } | null;
  merchant?: { id: string; name: string } | null;
  attributes?: Record<string, unknown> | null;
  keyFeatures?: string[];
}

export function toStockStatus(stockQuantity: number, status: string): StockStatus {
  if (status !== 'ACTIVE' || stockQuantity <= 0) return 'out_of_stock';
  if (stockQuantity <= LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
}

/** Human-readable feature bullets derived strictly from stored attributes. */
export function toKeyFeatures(
  attributes: Record<string, unknown> | null | undefined,
  limit = 5,
): string[] {
  if (!attributes) return [];
  const features: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    const label = key.replace(/_/g, ' ');
    if (value === true) features.push(label);
    else features.push(`${label}: ${String(value)}`);
    if (features.length >= limit) break;
  }
  return features;
}
