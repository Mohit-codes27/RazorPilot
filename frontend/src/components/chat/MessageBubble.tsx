"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/api";
import { useCartMutation } from "@/hooks/useCart";
import { ProductImage } from "@/components/ui/ProductImage";
import type { AgentAction, AgentResponse } from "@/types/agent";
import type { ProductCard } from "@/types/product";

function ActionButtons({ actions }: { actions: AgentAction[] }) {
  const router = useRouter();
  const { addItem } = useCartMutation();
  if (!actions || actions.length === 0) return null;
  const run = async (a: AgentAction) => {
    if (a.type === "add_to_cart" && a.productId) {
      await addItem.mutateAsync({ productId: a.productId, quantity: a.quantity ?? 1 });
    } else if (a.type === "view_product" || a.type === "buy_product") {
      if (a.productId) router.push(`/products/${a.productId}`);
    } else if (a.type === "checkout") {
      router.push("/checkout");
    } else if (a.type === "continue_shopping") {
      router.push("/discover");
    }
  };
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.slice(0, 4).map((a, i) => (
        <button
          key={`${a.type}-${i}`}
          onClick={() => run(a)}
          className="rounded-pill border border-accent-blue/40 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-accent-blue hover:bg-blue-100"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function CompareTable({ products }: { products: ProductCard[] }) {
  const rows: Array<{ label: string; get: (p: ProductCard) => string }> = [
    { label: "Price", get: (p) => formatINR(p.price) },
    { label: "Rating", get: (p) => (p.rating !== undefined ? `★ ${p.rating.toFixed(1)}` : "—") },
    {
      label: "Battery",
      get: (p) => {
        const b = p.attributes?.["battery_hours"];
        return typeof b === "number" ? `${b}h` : "—";
      },
    },
    {
      label: "Wireless",
      get: (p) => (p.attributes?.["wireless"] === true ? "✓" : "—"),
    },
    {
      label: "ANC",
      get: (p) => (p.attributes?.["noise_cancellation"] === true ? "✓" : "—"),
    },
    {
      label: "Weight",
      get: (p) => {
        const w = p.attributes?.["weight_grams"];
        return typeof w === "number" ? `${w}g` : "—";
      },
    },
  ];
  return (
    <div className="mt-3 overflow-x-auto rounded-card border border-slate-200 bg-surface">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr>
            <th className="p-3 text-left" />
            {products.map((p) => (
              <th key={p.id} className="p-3 text-left text-xs font-semibold text-ink">
                <Link href={`/products/${p.id}`} className="hover:text-accent-blue">
                  {p.name}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-slate-100">
              <td className="p-3 text-xs font-medium text-ink-muted">{r.label}</td>
              {products.map((p) => (
                <td key={p.id} className="p-3 text-sm text-ink">
                  {r.get(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderPreviewCard({ order }: { order: Record<string, unknown> }) {
  const pricing = (order["pricing"] ?? {}) as Record<string, number | string>;
  const items = (order["items"] ?? []) as Array<Record<string, unknown>>;
  const checks = (order["securityChecks"] as Record<string, boolean> | undefined) ?? {};
  return (
    <div className="mt-3 rounded-card border border-slate-200 bg-surface p-4">
      {items.slice(0, 3).map((i) => (
        <div key={String(i["productId"])} className="flex justify-between py-1 text-sm">
          <span className="text-ink">
            {String(i["productName"])} × {String(i["quantity"])}
          </span>
          <span className="font-semibold">{formatINR(Number(i["totalPrice"] ?? 0))}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-bold">
        <span>Total</span>
        <span>{formatINR(Number(pricing["total"] ?? 0))}</span>
      </div>
      <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
        <div className="font-bold">🔒 RazorPilot Safety Check</div>
        {checks.priceVerified && <div>✓ Price verified</div>}
        {checks.stockVerified && <div>✓ Availability verified</div>}
        {checks.totalVerified && <div>✓ Total verified</div>}
      </div>
      <Link
        href="/checkout"
        className="gradient-btn mt-3 block rounded-pill py-2.5 text-center text-sm font-semibold text-white"
      >
        Review & Pay →
      </Link>
    </div>
  );
}

export function AssistantTurn({ turn }: { turn: AgentResponse }) {
  const { addItem } = useCartMutation();
  return (
    <div className="animate-fade-up">
      <div className="mb-1 text-xs font-bold text-accent-violet">✦ RazorPilot</div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{turn.message}</div>

      {turn.type === "product_comparison" && turn.products && turn.products.length > 0 ? (
        <CompareTable products={turn.products} />
      ) : (
        turn.products &&
        turn.products.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {turn.products.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="overflow-hidden rounded-card border border-slate-200 bg-surface shadow-soft"
              >
                <ProductImage
                  src={p.imageUrl}
                  alt={p.name}
                  categorySlug={p.category?.slug}
                  className="aspect-video w-full"
                />
                <div className="p-3">
                  <Link href={`/products/${p.id}`} className="text-sm font-semibold hover:text-accent-blue">
                    {p.name}
                  </Link>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="font-bold">{formatINR(p.price)}</span>
                    {p.rating !== undefined && (
                      <span className="text-xs text-ink-muted">★ {p.rating.toFixed(1)}</span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Link
                      href={`/products/${p.id}`}
                      className="flex-1 rounded-pill border border-slate-300 py-1.5 text-center text-xs font-semibold"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => addItem.mutate({ productId: p.id, quantity: 1 })}
                      className="gradient-btn flex-1 rounded-pill py-1.5 text-xs font-semibold text-white"
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {turn.recommendation && (
        <div className="mt-3 rounded-card border border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50 p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-accent-violet">
            ✦ Why I recommend this
          </div>
          <div className="mt-1 text-sm font-bold text-ink">{turn.recommendation.productName}</div>
          <p className="mt-1 text-sm text-ink-soft">{turn.recommendation.reason}</p>
          {(turn.recommendation.matchedPreferences ?? []).map((m) => (
            <div key={m} className="text-sm text-emerald-700">
              ✓ {m}
            </div>
          ))}
        </div>
      )}

      {(turn.type === "order_preview" || turn.type === "payment_ready") && !!turn.order && (
        <OrderPreviewCard order={turn.order as Record<string, unknown>} />
      )}

      {turn.type === "cart_update" && (
        <Link href="/cart" className="mt-3 inline-block text-sm font-semibold text-accent-blue">
          View cart →
        </Link>
      )}

      {turn.actions && <ActionButtons actions={turn.actions} />}
    </div>
  );
}

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="animate-fade-up ml-auto max-w-[85%] rounded-card rounded-br-sm bg-ink px-4 py-3 text-sm text-white">
      {text}
    </div>
  );
}
