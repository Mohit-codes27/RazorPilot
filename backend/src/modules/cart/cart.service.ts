import { Prisma } from '@prisma/client';
import { PRODUCT_STATUS } from '../../config/constants.js';
import { prisma } from '../../db/prisma.js';
import { NotFoundError, ProductOutOfStockError } from '../../utils/errors.js';

const cartSelect = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: { createdAt: 'asc' } as const,
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      createdAt: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          currency: true,
          stockQuantity: true,
          status: true,
          imageUrl: true,
        },
      },
    },
  },
} as const;

type CartRow = Prisma.CartGetPayload<{ select: typeof cartSelect }>;

export interface CartItemDTO {
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

export interface CartDTO {
  id: string;
  status: string;
  items: CartItemDTO[];
  itemCount: number;
  subtotal: number;
  pricing: {
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    currency: string;
  };
  updatedAt: string;
  currency: string;
}

export function toCartDTO(row: CartRow): CartDTO {
  const items: CartItemDTO[] = row.items.map((i) => {
    const unitPrice = Number(i.unitPrice);
    return {
      id: i.id,
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice,
      lineTotal: unitPrice * i.quantity,
      product: {
        id: i.product.id,
        name: i.product.name,
        slug: i.product.slug,
        price: Number(i.product.price),
        currency: i.product.currency,
        stockQuantity: i.product.stockQuantity,
        status: i.product.status,
        imageUrl: i.product.imageUrl,
      },
    };
  });
  const subtotal = items.reduce((n, i) => n + i.lineTotal, 0);
  return {
    id: row.id,
    status: row.status,
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    subtotal,
    pricing: {
      subtotal,
      discount: 0,
      shipping: 0,
      total: subtotal,
      currency: 'INR',
    },
    updatedAt: row.updatedAt.toISOString(),
    currency: 'INR',
  };
}

async function getOrCreateActiveCart(userId: string): Promise<CartRow> {
  const existing = await prisma.cart.findFirst({
    where: { userId, status: 'ACTIVE' },
    select: cartSelect,
  });
  if (existing) return existing;
  return prisma.cart.create({
    data: { userId, status: 'ACTIVE' },
    select: cartSelect,
  });
}

async function loadActiveCartOrThrow(userId: string): Promise<CartRow> {
  const cart = await getOrCreateActiveCart(userId);
  return cart;
}

async function loadPurchasableProduct(productId: string, quantity: number) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status === PRODUCT_STATUS.INACTIVE) {
    throw new NotFoundError('Product not found');
  }
  if (product.status !== PRODUCT_STATUS.ACTIVE) {
    throw new ProductOutOfStockError('Product is not available for purchase');
  }
  if (quantity > product.stockQuantity) {
    throw new ProductOutOfStockError(
      `Insufficient stock: only ${product.stockQuantity} available`,
    );
  }
  return product;
}

export async function getCart(userId: string): Promise<CartDTO> {
  const cart = await loadActiveCartOrThrow(userId);
  return toCartDTO(cart);
}

export async function addItem(userId: string, productId: string, quantity: number): Promise<CartDTO> {
  const cart = await getOrCreateActiveCart(userId);
  const existing = cart.items.find((i) => i.product.id === productId);
  const targetQty = (existing?.quantity ?? 0) + quantity;

  const product = await loadPurchasableProduct(productId, targetQty);

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: targetQty, unitPrice: product.price },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
        unitPrice: product.price,
      },
    });
  }

  const updated = await prisma.cart.findUniqueOrThrow({
    where: { id: cart.id },
    select: cartSelect,
  });
  return toCartDTO(updated);
}

async function loadOwnedItem(userId: string, itemId: string) {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    select: { id: true, quantity: true, cart: { select: { id: true, userId: true, status: true } } },
  });
  if (!item || item.cart.userId !== userId || item.cart.status !== 'ACTIVE') {
    throw new NotFoundError('Cart item not found');
  }
  return item;
}

export async function updateItem(
  userId: string,
  itemId: string,
  quantity: number,
): Promise<CartDTO> {
  const item = await loadOwnedItem(userId, itemId);
  const cartItem = await prisma.cartItem.findUniqueOrThrow({
    where: { id: item.id },
    select: { productId: true, cartId: true },
  });
  const product = await loadPurchasableProduct(cartItem.productId, quantity);

  await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity, unitPrice: product.price },
  });

  const updated = await prisma.cart.findUniqueOrThrow({
    where: { id: cartItem.cartId },
    select: cartSelect,
  });
  return toCartDTO(updated);
}

export async function removeItem(userId: string, itemId: string): Promise<CartDTO> {
  const item = await loadOwnedItem(userId, itemId);
  const cartId = item.cart.id;
  await prisma.cartItem.delete({ where: { id: item.id } });
  const updated = await prisma.cart.findUniqueOrThrow({
    where: { id: cartId },
    select: cartSelect,
  });
  return toCartDTO(updated);
}

export async function clearCart(userId: string): Promise<CartDTO> {
  const cart = await getOrCreateActiveCart(userId);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  const updated = await prisma.cart.findUniqueOrThrow({
    where: { id: cart.id },
    select: cartSelect,
  });
  return toCartDTO(updated);
}
