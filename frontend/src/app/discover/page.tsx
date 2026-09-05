"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { useCartMutation } from "@/hooks/useCart";
import { ProductCardView } from "@/components/products/ProductCard";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import type { Pagination, ProductCard, ProductCategory } from "@/types/product";

function DiscoverInner() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [category, setCategory] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const { addItem, invalidate } = useCartMutation();
  const [addingId, setAddingId] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ data: ProductCategory[] }>("/categories").then((r) => r.data),
  });

  const query = new URLSearchParams({
    ...(submitted ? { q: submitted } : {}),
    ...(category ? { category } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    sort,
    page: String(page),
    pageSize: "12",
  }).toString();
  const endpoint = submitted ? `/products/search?${query}` : `/products?${query}`;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["discover", endpoint],
    queryFn: () => api.get<{ data: ProductCard[]; pagination: Pagination }>(endpoint),
    placeholderData: keepPreviousData,
  });

  const add = async (id: string) => {
    setAddingId(id);
    try {
      await addItem.mutateAsync({ productId: id, quantity: 1 });
      invalidate();
    } finally {
      setAddingId(null);
    }
  };

  const resetPage = () => setPage(1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="text-2xl font-extrabold text-ink">Discover</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q);
          resetPage();
        }}
        className="mt-4 flex items-center gap-2 rounded-pill border border-slate-200 bg-surface p-2 pl-5 shadow-soft"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
        />
        <button type="submit" className="gradient-btn rounded-full px-5 py-2 text-sm font-semibold text-white">
          Search
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            resetPage();
          }}
          className="rounded-pill border border-slate-200 bg-surface px-3 py-1.5"
        >
          <option value="">All categories</option>
          {(categories ?? []).map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={maxPrice}
          onChange={(e) => {
            setMaxPrice(e.target.value.replace(/[^0-9]/g, ""));
            resetPage();
          }}
          placeholder="Max ₹"
          inputMode="numeric"
          className="w-28 rounded-pill border border-slate-200 bg-surface px-3 py-1.5"
        />
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            resetPage();
          }}
          className="rounded-pill border border-slate-200 bg-surface px-3 py-1.5"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>

      <div className="mt-6">
        {isLoading && <CardSkeleton count={8} />}
        {isError && <ErrorState message="Couldn't load products." onRetry={() => refetch()} />}
        {data && data.data.length === 0 && (
          <EmptyState
            title="No products found"
            body="Try a different search or clear the filters."
            actionLabel="AI Shopping →"
            actionHref="/chat"
          />
        )}
        {data && data.data.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {data.data.map((p) => (
                <ProductCardView key={p.id} product={p} onAdd={add} adding={addingId === p.id} />
              ))}
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-pill border border-slate-200 px-4 py-1.5 disabled:opacity-40"
              >
                ←
              </button>
              <span className="text-ink-muted">
                {page} / {Math.max(1, data.pagination.totalPages)}
              </span>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-pill border border-slate-200 px-4 py-1.5 disabled:opacity-40"
              >
                →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <AppShell>
      <DiscoverInner />
    </AppShell>
  );
}
