"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatINR, api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useCartMutation } from "@/hooks/useCart";
import { ProductImage } from "@/components/ui/ProductImage";
import { ErrorState } from "@/components/ui/states";
import type { ProductCard } from "@/types/product";

function ProductDetailInner() {
  const params = useParams<{ id: string }>();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCartMutation();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["product", params.id],
    queryFn: () => api.get<{ product: ProductCard }>(`/products/${params.id}`).then((r) => r.product),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="skeleton h-64 rounded-card" />
        <div className="skeleton mt-4 h-6 w-1/2 rounded" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <ErrorState message="Couldn't load this product." onRetry={() => refetch()} />
      </div>
    );
  }
  const p = data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/discover" className="text-sm font-semibold text-ink-muted hover:text-ink">
          ← Back
        </Link>
        <span className="text-sm font-semibold text-ink-muted">Product Details</span>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <ProductImage
          src={p.imageUrl}
          alt={p.name}
          categorySlug={p.category?.slug}
          className="aspect-square w-full rounded-card border border-slate-200"
        />
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{p.name}</h1>
          {p.rating !== undefined && (
            <div className="mt-1 text-sm text-ink-muted">
              ★ {p.rating.toFixed(1)}
              {p.reviewCount !== undefined && ` · ${(p.reviewCount / 1000).toFixed(1)}k reviews`}
            </div>
          )}
          <div className="mt-2 text-3xl font-extrabold text-ink">{formatINR(p.price)}</div>
          <div className="mt-1 text-sm font-medium text-emerald-700">
            {p.stockStatus === "out_of_stock" ? "Out of stock" : p.stockStatus === "low_stock" ? "Only a few left" : "✓ In stock"}
          </div>
          {p.description && <p className="mt-3 text-sm text-ink-soft">{p.description}</p>}
          {(p.keyFeatures ?? []).length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-bold text-ink">Key features</div>
              <ul className="mt-1 space-y-1 text-sm text-ink-soft">
                {(p.keyFeatures ?? []).map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm font-medium text-ink-soft">Quantity</span>
            <button onClick={() => setQty((v) => Math.max(1, v - 1))} className="rounded-full border border-slate-300 px-3 py-1">
              −
            </button>
            <span className="w-6 text-center font-bold">{qty}</span>
            <button onClick={() => setQty((v) => v + 1)} className="rounded-full border border-slate-300 px-3 py-1">
              +
            </button>
          </div>
          <button
            disabled={p.stockStatus === "out_of_stock"}
            onClick={async () => {
              await addItem.mutateAsync({ productId: p.id, quantity: qty });
              setAdded(true);
            }}
            className="gradient-btn mt-4 w-full rounded-pill py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {p.stockStatus === "out_of_stock" ? "Out of stock" : added ? "✓ Added to cart" : "Add to cart"}
          </button>
          {added && (
            <Link href="/cart" className="mt-2 block text-center text-sm font-semibold text-accent-blue">
              Go to cart →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <AppShell>
      <ProductDetailInner />
    </AppShell>
  );
}
