"use client";

import Link from "next/link";
import { formatINR } from "@/lib/api";
import type { ProductCard } from "@/types/product";
import { ProductImage } from "../ui/ProductImage";

function Stars({ rating, reviewCount }: { rating?: number; reviewCount?: number }) {
  if (rating === undefined) return null;
  return (
    <div className="text-xs text-ink-muted">
      ★ {rating.toFixed(1)}
      {reviewCount !== undefined && <span> · {(reviewCount / 1000).toFixed(1)}k reviews</span>}
    </div>
  );
}

export function ProductCardView({
  product,
  onAdd,
  adding,
}: {
  product: ProductCard;
  onAdd?: (id: string) => void;
  adding?: boolean;
}) {
  return (
    <div className="animate-fade-up flex flex-col overflow-hidden rounded-card border border-slate-200 bg-surface shadow-soft transition hover:shadow-lift">
      <Link href={`/products/${product.id}`}>
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          categorySlug={product.category?.slug}
          className="aspect-square w-full"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <Link href={`/products/${product.id}`} className="font-semibold text-ink hover:text-accent-blue">
          {product.name}
        </Link>
        <Stars rating={product.rating} reviewCount={product.reviewCount} />
        <div className="text-lg font-bold text-ink">{formatINR(product.price)}</div>
        {product.keyFeatures?.slice(0, 2).map((f) => (
          <div key={f} className="truncate text-xs text-ink-muted">
            • {f}
          </div>
        ))}
        <div className="mt-auto flex gap-2 pt-3">
          <Link
            href={`/products/${product.id}`}
            className="flex-1 rounded-pill border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-ink hover:bg-slate-50"
          >
            View
          </Link>
          {onAdd && (
            <button
              onClick={() => onAdd(product.id)}
              disabled={adding || product.stockStatus === "out_of_stock"}
              className="gradient-btn flex-1 rounded-pill px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {product.stockStatus === "out_of_stock" ? "Out of stock" : adding ? "Adding…" : "Add to cart"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
