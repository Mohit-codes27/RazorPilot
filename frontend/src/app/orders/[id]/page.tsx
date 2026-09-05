"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, formatINR, api } from "@/lib/api";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { ProductImage } from "@/components/ui/ProductImage";
import { ErrorState } from "@/components/ui/states";
import type { Order } from "@/types/order";

function OrderDetailInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ["order", params.id],
    queryFn: () => api.get<{ order: Order }>(`/orders/${params.id}`).then((r) => r.order),
    retry: false,
  });

  const cancel = async () => {
    setCancelling(true);
    setError("");
    try {
      await api.patch(`/orders/${params.id}/status`, { status: "CANCELLED" });
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel the order");
    } finally {
      setCancelling(false);
      router.refresh();
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
        <div className="skeleton h-24 rounded-card" />
        <div className="skeleton h-64 rounded-card" />
      </div>
    );
  }
  if (isError || !order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <ErrorState message="Couldn't load this order." onRetry={() => refetch()} />
      </div>
    );
  }

  const cancellable = order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/orders" className="text-sm font-semibold text-ink-muted hover:text-ink">
          ← Orders
        </Link>
        <span className="text-sm font-bold text-ink">Order #{order.orderNumber}</span>
      </div>

      <div className="mt-4 rounded-card border border-slate-200 bg-surface p-5 shadow-soft">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 py-2">
            <ProductImage src={i.imageUrl} alt={i.productName} className="h-12 w-12 rounded-xl" />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-ink">{i.productName}</div>
              <div className="text-ink-muted">Qty {i.quantity}</div>
            </div>
            <div className="text-sm font-bold">{formatINR(i.totalPrice)}</div>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 font-extrabold">
          <span>Total</span>
          <span>{formatINR(order.total)}</span>
        </div>
        {cancellable && (
          <button
            onClick={cancel}
            disabled={cancelling}
            className="mt-3 w-full rounded-pill border border-red-200 py-2 text-sm font-semibold text-danger hover:bg-red-50 disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel order"}
          </button>
        )}
        {error && <div className="mt-2 text-sm text-danger">{error}</div>}
      </div>

      <div className="mt-4 rounded-card border border-slate-200 bg-surface p-5 shadow-soft">
        <h2 className="font-bold text-ink">Order Status</h2>
        <div className="mt-3">
          {order.timeline.map((t, idx) => (
            <div key={t.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    t.status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : t.status === "current"
                        ? "bg-blue-100 text-accent-blue"
                        : "border border-slate-200 text-ink-faint"
                  }`}
                >
                  {t.status === "completed" ? "✓" : t.status === "current" ? "→" : "○"}
                </span>
                {idx < order.timeline.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
              </div>
              <div className="pb-5">
                <div className="text-sm font-semibold text-ink">{t.title}</div>
                <div className="text-xs text-ink-faint">
                  {new Date(t.timestamp).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {t.status === "current" && " · Current"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <AppShell>
        <OrderDetailInner />
      </AppShell>
    </RequireAuth>
  );
}
