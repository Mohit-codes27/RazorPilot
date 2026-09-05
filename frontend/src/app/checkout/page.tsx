"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, api, formatINR } from "@/lib/api";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { ProductImage } from "@/components/ui/ProductImage";
import type { CheckoutData, OrderPreview } from "@/types/order";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
    __rzpLoaded?: boolean;
  }
}

function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.Razorpay) return Promise.resolve();
  if (window.__rzpLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => {
      window.__rzpLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout"));
    document.body.appendChild(script);
  });
}

function CheckoutInner() {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const { data: preview, isLoading } = useQuery({
    queryKey: ["order-preview"],
    queryFn: () => api.post<OrderPreview>("/orders/preview", {}),
    retry: false,
  });

  const confirmAndPay = async () => {
    if (!preview || paying) return;
    setError("");
    setPaying(true);
    try {
      const order = await api.post<{ order: { id: string } }>("/orders", {});
      const init = await api.post<{ payment: unknown; checkout: CheckoutData }>("/payments/create", {
        orderId: order.order.id,
      });
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay failed to load");
      const rzp = new window.Razorpay({
        key: init.checkout.razorpayKeyId,
        amount: init.checkout.amountPaise,
        currency: init.checkout.currency,
        order_id: init.checkout.razorpayOrderId,
        name: "RazorPilot",
        description: `Order ${init.checkout.orderNumber}`,
        modal: {
          ondismiss: () => {
            setPaying(false);
            setError("Payment was cancelled before completion. No money was charged.");
          },
        },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verify = await api.post<{ success: boolean; status: string; order: { id: string } }>(
              "/payments/verify",
              {
                providerOrderId: resp.razorpay_order_id,
                providerPaymentId: resp.razorpay_payment_id,
                signature: resp.razorpay_signature,
              },
            );
            if (verify.success && verify.status === "PAID") {
              router.push(`/checkout/success?orderId=${verify.order.id}`);
            } else {
              router.push("/checkout/failed");
            }
          } catch {
            router.push("/checkout/failed");
          }
        },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start payment. Try again.");
      setPaying(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="flex items-center justify-between">
        <Link href="/cart" className="text-sm font-semibold text-ink-muted hover:text-ink">
          ← Back
        </Link>
        <span className="text-sm font-bold text-ink">Secure Checkout 🔒</span>
      </div>
      <h1 className="mt-4 text-center text-xl font-extrabold text-ink">Review your order</h1>

      {isLoading && <div className="skeleton mt-4 h-64 rounded-card" />}
      {preview && (
        <>
          <div className="mt-4 rounded-card border border-slate-200 bg-surface p-5 shadow-soft">
            {preview.items.map((i) => (
              <div key={i.productId} className="flex items-center gap-3 py-2">
                <ProductImage src={i.imageUrl} alt={i.productName} className="h-12 w-12 rounded-xl" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold text-ink">{i.productName}</div>
                  <div className="text-ink-muted">Qty {i.quantity}</div>
                </div>
                <div className="text-sm font-bold">{formatINR(i.totalPrice)}</div>
              </div>
            ))}
            <div className="mt-2 space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>{formatINR(preview.pricing.subtotal)}</span>
              </div>
              <div className="flex justify-between text-ink-soft">
                <span>Shipping</span>
                <span>{preview.pricing.shipping === 0 ? "FREE" : formatINR(preview.pricing.shipping)}</span>
              </div>
              <div className="flex justify-between pt-1 text-base font-extrabold text-ink">
                <span>Total</span>
                <span>{formatINR(preview.pricing.total)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-card border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="text-sm font-bold text-ink">🔒 RazorPilot Safety Check</div>
            <div className="mt-2 space-y-1 text-sm text-emerald-900">
              {preview.securityChecks.priceVerified && <div>✓ Price verified</div>}
              {preview.securityChecks.stockVerified && <div>✓ Product availability verified</div>}
              {preview.securityChecks.totalVerified && <div>✓ Order total verified</div>}
              <div>✓ Payment requires your confirmation</div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-danger">{error}</div>
          )}
          <button
            onClick={confirmAndPay}
            disabled={paying}
            className="gradient-btn mt-4 w-full rounded-pill py-3.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {paying ? "Preparing secure payment…" : `Confirm & Pay ${formatINR(preview.pricing.total)}`}
          </button>
          <p className="mt-3 text-center text-xs text-ink-faint">Secure payment powered by Razorpay</p>
        </>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <AppShell>
        <CheckoutInner />
      </AppShell>
    </RequireAuth>
  );
}
