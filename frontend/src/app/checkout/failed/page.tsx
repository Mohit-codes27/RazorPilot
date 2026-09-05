"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";

function FailedInner() {
  return (
    <div className="mx-auto max-w-md px-4 py-14 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-danger">
        ⚠
      </div>
      <h1 className="mt-4 text-2xl font-extrabold text-ink">Payment didn&apos;t go through</h1>
      <p className="mt-2 text-sm text-ink-muted">
        No money was charged and your cart is still saved. Check your order status before trying again.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/cart"
          className="gradient-btn rounded-pill py-3 text-center text-sm font-semibold text-white"
        >
          Try Again
        </Link>
        <div className="flex gap-3">
          <Link
            href="/cart"
            className="flex-1 rounded-pill border border-slate-300 py-2.5 text-center text-sm font-semibold"
          >
            Back to Cart
          </Link>
          <Link
            href="/orders"
            className="flex-1 rounded-pill border border-slate-300 py-2.5 text-center text-sm font-semibold"
          >
            Check Order Status
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutFailedPage() {
  return (
    <RequireAuth>
      <AppShell>
        <FailedInner />
      </AppShell>
    </RequireAuth>
  );
}
