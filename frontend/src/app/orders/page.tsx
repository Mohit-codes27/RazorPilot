"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatINR, api } from "@/lib/api";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { ProductImage } from "@/components/ui/ProductImage";
import { EmptyState } from "@/components/ui/states";
import type { OrderListItem } from "@/types/order";
import type { Pagination } from "@/types/product";

function OrdersInner() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["orders", status, page],
    queryFn: () =>
      api.get<{ data: OrderListItem[]; pagination: Pagination }>(
        `/orders?page=${page}&pageSize=10${status ? `&status=${status}` : ""}`,
      ),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-ink">Your Orders</h1>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-pill border border-slate-200 bg-surface px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="PENDING_PAYMENT">Pending</option>
          <option value="PAID">Paid</option>
          <option value="PAYMENT_FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="DELIVERED">Delivered</option>
        </select>
      </div>
      {isLoading && (
        <div className="mt-4 space-y-3">
          <div className="skeleton h-32 rounded-card" />
          <div className="skeleton h-32 rounded-card" />
        </div>
      )}
      {data && data.data.length === 0 && (
        <div className="mt-4">
          <EmptyState
            title="No orders yet"
            body="Your completed purchases will appear here."
            actionLabel="Start Shopping →"
            actionHref="/chat"
          />
        </div>
      )}
      <div className="mt-4 space-y-3">
        {(data?.data ?? []).map((o) => (
          <div key={o.id} className="rounded-card border border-slate-200 bg-surface p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="font-bold text-ink">#{o.orderNumber}</span>
              <span
                className={`rounded-pill px-3 py-1 text-xs font-bold ${
                  o.status === "PAID" || o.status === "DELIVERED"
                    ? "bg-emerald-100 text-emerald-700"
                    : o.status === "PAYMENT_FAILED" || o.status === "CANCELLED"
                      ? "bg-red-100 text-danger"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {o.status === "PAID" ? "PAID ✓" : o.status}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <ProductImage src={o.previewImageUrl} alt={o.orderNumber} className="h-14 w-14 rounded-xl" />
              <div className="text-sm">
                <div className="text-ink-soft">{o.itemCount} item{o.itemCount === 1 ? "" : "s"}</div>
                <div className="font-bold text-ink">{formatINR(o.total)}</div>
                <div className="text-xs text-ink-faint">
                  Order placed · {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </div>
              </div>
              <Link
                href={`/orders/${o.id}`}
                className="ml-auto text-sm font-semibold text-accent-blue hover:underline"
              >
                View order →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <AppShell>
        <OrdersInner />
      </AppShell>
    </RequireAuth>
  );
}
