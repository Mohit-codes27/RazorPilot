import { Prisma } from '@prisma/client';
import { VISIBLE_PRODUCT_STATUSES } from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';
import {
  toKeyFeatures,
  toStockStatus,
  type StockStatus,
} from '../../types/product.js';
import { NotFoundError } from '../../utils/errors.js';
import type { ListProductsInput, SearchProductsInput } from './product.schemas.js';

type ProductFilters = Omit<ListProductsInput, 'page' | 'pageSize'> & { q?: string };

const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  currency: true,
  stockQuantity: true,
  status: true,
  attributes: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  merchant: { select: { id: true, name: true } },
} as const;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

export interface ProductDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  stockQuantity: number;
  status: string;
  attributes: unknown;
  imageUrl: string | null;
  imageUrls: string[];
  stockStatus: StockStatus;
  rating?: number;
  reviewCount?: number;
  keyFeatures: string[];
  category: { id: string; name: string; slug: string } | null;
  merchant: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

export function toProductDTO(row: ProductRow): ProductDTO {
  const attributes = (row.attributes ?? null) as Record<string, unknown> | null;
  const rating = typeof attributes?.['rating'] === 'number' ? (attributes['rating'] as number) : undefined;
  const reviewCount =
    typeof attributes?.['review_count'] === 'number' ? (attributes['review_count'] as number) : undefined;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    currency: row.currency,
    stockQuantity: row.stockQuantity,
    status: row.status,
    attributes: row.attributes,
    imageUrl: row.imageUrl,
    imageUrls: row.imageUrl ? [row.imageUrl] : [],
    stockStatus: toStockStatus(row.stockQuantity, row.status),
    keyFeatures: toKeyFeatures(attributes),
    ...(rating !== undefined ? { rating } : {}),
    ...(reviewCount !== undefined ? { reviewCount } : {}),
    category: row.category,
    merchant: row.merchant,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildWhere(filters: ProductFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    status: { in: [...VISIBLE_PRODUCT_STATUSES] },
  };

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { description: { contains: filters.q, mode: 'insensitive' } },
    ];
  }
  if (filters.category) {
    where.category = { slug: filters.category };
  }
  if (filters.merchant) {
    where.merchantId = filters.merchant;
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {};
    if (filters.minPrice !== undefined) where.price.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) where.price.lte = filters.maxPrice;
  }
  if (filters.availability === 'in_stock') {
    where.status = { equals: 'ACTIVE' };
    where.stockQuantity = { gt: 0 };
  } else if (filters.availability === 'out_of_stock') {
    where.OR = [{ stockQuantity: 0 }, { status: 'OUT_OF_STOCK' }];
  }

  return where;
}

export interface PaginatedProducts {
  data: ProductDTO[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

async function queryProducts(
  filters: ProductFilters,
  page: number,
  pageSize: number,
): Promise<PaginatedProducts> {
  const where = buildWhere(filters);
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    filters.sort === 'price_asc'
      ? [{ price: 'asc' }, { id: 'asc' }]
      : filters.sort === 'price_desc'
        ? [{ price: 'desc' }, { id: 'asc' }]
        : [{ createdAt: 'desc' }, { id: 'asc' }];
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: productSelect,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    data: rows.map(toProductDTO),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

export async function listProducts(input: ListProductsInput): Promise<PaginatedProducts> {
  const { page, pageSize, ...filters } = input;
  return queryProducts(filters, page, pageSize);
}

export async function searchProducts(input: SearchProductsInput): Promise<PaginatedProducts> {
  const { page, pageSize, ...filters } = input;
  return queryProducts(filters, page, pageSize);
}

export async function getProductById(id: string): Promise<ProductDTO> {
  const row = await prisma.product.findFirst({
    where: { id, status: { in: [...VISIBLE_PRODUCT_STATUSES] } },
    select: productSelect,
  });
  if (!row) {
    throw new NotFoundError('Product not found');
  }
  return toProductDTO(row);
}

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export async function listCategories(): Promise<CategoryDTO[]> {
  const rows = await prisma.productCategory.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { products: { where: { status: { in: [...VISIBLE_PRODUCT_STATUSES] } } } } },
    },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, productCount: r._count.products }));
}
