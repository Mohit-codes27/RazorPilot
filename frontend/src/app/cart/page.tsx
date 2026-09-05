"use client";

import Link from "next/link";
import { formatINR } from "@/lib/api";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { useCart, useCartMutation } from "@/hooks/useCart";
import { ProductImage } from "@/components/ui/ProductImage";
import { EmptyState } from "@/components/ui/states";

function CartInner() {
  const { data: cart, isLoading } = useCart();
  const { updateItem, removeItem } = useCartMutation();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-6">
        <div className="skeleton h-28 rounded-card" />
        <div className="skeleton h-28 rounded-card" />
      </div>
    );
  }
  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <EmptyState
          title="Your cart is empty"
          body="Tell RazorPilot what you're looking for and we'll help you find it."
          actionLabel="Start Shopping →"
          actionHref="/chat"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/discover" className="text-sm font-semibold text-ink-muted hover:text-ink">
          ← Continue Shopping
        </Link>
        <h1 className="font-bold text-ink">🛒 Your Cart</h1>
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {cart.items.map((item) => (
            <div key={item.id} className="flex gap-4 rounded-card border border-slate-200 bg-surface p-4 shadow-soft">
              <ProductImage
                src={item.product.imageUrl}
                alt={item.product.name}
                className="h-20 w-20 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <Link href={`/products/${item.productId}`} className="truncate text-sm font-semibold hover:text-accent-blue">
                  {item.product.name}
                </Link>
                <div className="text-sm font-bold">{formatINR(item.unitPrice)}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-ink-muted">Qty</span>
                  <button
                    onClick={() => updateItem.mutate({ id: item.id, quantity: Math.max(1, item.quantity - 1) })}
                    className="rounded-full border border-slate-300 px-2.5 py-0.5 text-sm"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                  <button
                    onClick={() => updateItem.mutate({ id: item.id, quantity: item.quantity + 1 })}
                    className="rounded-full border border-slate-300 px-2.5 py-0.5 text-sm"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeItem.mutate(item.id)}
                    className="ml-auto text-xs font-semibold text-danger hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="h-fit rounded-card border border-slate-200 bg-surface p-5 shadow-soft">
          <h2 className="font-bold text-ink">Order Summary</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-soft">
              <span>Subtotal</span>
              <span>{formatINR(cart.pricing.subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>Shipping</span>
              <span>{cart.pricing.shipping === 0 ? "FREE" : formatINR(cart.pricing.shipping)}</span>
            </div>
            <div className="flex justify-between text-ink-soft">
              <span>Discount</span>
              <span>{formatINR(cart.pricing.discount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-ink">
              <span>Total</span>
              <span>{formatINR(cart.pricing.total)}</span>
            </div>
          </div>
          <Link
            href="/checkout"
            className="gradient-btn mt-4 block rounded-pill py-2.5 text-center text-sm font-semibold text-white"
          >
            Checkout →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <RequireAuth>
      <AppShell>
        <CartInner />
      </AppShell>
    </RequireAuth>
  );
}
