export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  price: number;
  currency: string;
  rating?: number;
  reviewCount?: number;
  stockStatus: StockStatus;
  quantityAvailable?: number;
  category?: { id: string; name: string; slug?: string } | null;
  merchant?: { id: string; name: string } | null;
  attributes?: Record<string, unknown> | null;
  keyFeatures?: string[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}
