"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatINR, api } from "@/lib/api";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import type { Order } from "@/types/order";

function SuccessInner() {
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.get<{ order: Order }>(`/orders/${orderId}`).then((r) => r.order),
    enabled: !!orderId,
    retry: false,
  });

  return (
    <div className="mx-auto max-w-md px-4 py-14 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
        ✓
      </div>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">Payment successful</h1>
      <p className="mt-1 text-sm text-ink-muted">Your order has been confirmed.</p>
      {order && (
        <div className="mt-6 rounded-card border border-slate-200 bg-surface p-5 text-left shadow-soft">
          <div className="font-bold text-ink">Order #{order.orderNumber}</div>
          {order.items.slice(0, 3).map((i) => (
            <div key={i.id} className="mt-1 flex justify-between text-sm">
              <span className="text-ink-soft">
                {i.productName} × {i.quantity}
              </span>
              <span className="font-semibold">{formatINR(i.totalPrice)}</span>
            </div>
          ))}
          <div className="mt-2 font-bold">{formatINR(order.total)}</div>
          <div className="mt-2 space-y-0.5 text-sm text-emerald-700">
            <div>✓ Payment verified</div>
            <div>✓ Order confirmed</div>
          </div>
        </div>
      )}
      <div className="mt-6 flex gap-3">
        {orderId && (
          <Link
            href={`/orders/${orderId}`}
            className="flex-1 rounded-pill border border-slate-300 py-2.5 text-center text-sm font-semibold"
          >
            View Order
          </Link>
        )}
        <Link href="/discover" className="gradient-btn flex-1 rounded-pill py-2.5 text-center text-sm font-semibold text-white">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense>
          <SuccessInner />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
