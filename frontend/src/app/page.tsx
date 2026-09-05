"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useMe } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { ProductImage } from "@/components/ui/ProductImage";
import { formatINR } from "@/lib/api";
import type { ProductCard } from "@/types/product";

const SUGGESTIONS = [
  "Wireless headphones under ₹5,000",
  "Best keyboard for coding",
  "Compare gaming mice",
];

export default function LandingPage() {
  const router = useRouter();
  const { data: user } = useMe();
  const [prompt, setPrompt] = useState("");
  const [starting, setStarting] = useState(false);

  const { data: picks } = useQuery({
    queryKey: ["top-picks"],
    queryFn: () =>
      api
        .get<{ data: ProductCard[] }>("/products?pageSize=4&sort=newest")
        .then((r) => r.data),
  });

  const startShopping = async (text: string) => {
    const message = text.trim();
    if (!message || starting) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent("/chat")}`);
      return;
    }
    setStarting(true);
    try {
      const s = await api.post<{ session: { id: string } }>("/agent/sessions", {});
      sessionStorage.setItem(`rp-first-message:${s.session.id}`, message);
      router.push(`/chat/${s.session.id}`);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-xl font-extrabold">✦ RAZOR<span className="gradient-text">PILOT</span></span>
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-soft md:flex">
          <Link href="/discover" className="hover:text-ink">Products</Link>
          <Link href="/chat" className="hover:text-ink">AI Shopping</Link>
          <Link href="/orders" className="hover:text-ink">Orders</Link>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/chat" className="text-sm font-semibold text-ink">
              {user.name} →
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-ink-soft hover:text-ink">
                Sign in
              </Link>
              <Link
                href="/chat"
                className="rounded-pill bg-ink px-4 py-2 text-sm font-semibold text-white"
              >
                Shop Now ↗
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="relative overflow-hidden py-14 text-center md:py-20">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-gradient-to-r from-accent-blue/15 via-accent-violet/15 to-accent-purple/15 blur-3xl" />
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-accent-blue">
            ⚡ AI-Powered Commerce
          </div>
          <h1 className="mx-auto mt-4 max-w-3xl text-balance text-5xl font-extrabold leading-tight text-ink md:text-6xl">
            SHOP SMARTER.
            <br />
            <span className="gradient-text">LET AI FIND WHAT FITS YOU.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-ink-muted">
            Tell RazorPilot what you need in plain language. It searches, compares,
            and recommends — you stay in control of every rupee.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startShopping(prompt);
            }}
            className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-pill border border-slate-200 bg-surface p-2 pl-5 shadow-soft"
          >
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What are you looking for?"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
            <button
              type="submit"
              disabled={starting}
              className="gradient-btn rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {starting ? "…" : "➜"}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => startShopping(s)}
                className="rounded-pill border border-slate-200 bg-surface px-4 py-1.5 text-xs font-medium text-ink-soft hover:border-accent-blue hover:text-accent-blue"
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-card bg-navy px-8 py-10 text-white md:px-12">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-lime">Built for smarter shopping</div>
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            {[
              { t: "✦ Understands", d: "Understands what you mean, not just keywords." },
              { t: "⚡ Compares", d: "Evaluates products based on your needs." },
              { t: "🔒 Protects", d: "Verifies price, stock and totals before payment." },
            ].map((f) => (
              <div key={f.t}>
                <div className="font-bold">{f.t}</div>
                <p className="mt-1 text-sm text-slate-300">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-14">
          <h2 className="text-2xl font-extrabold text-ink">AI-powered product discovery</h2>
          <p className="mt-1 text-sm text-ink-muted">RazorPilot finds the best matches for you.</p>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {(picks ?? []).map((p) => (
              <div key={p.id} className="overflow-hidden rounded-card border border-slate-200 bg-surface shadow-soft">
                <ProductImage src={p.imageUrl} alt={p.name} categorySlug={p.category?.slug} className="aspect-square w-full" />
                <div className="p-4">
                  <div className="truncate text-sm font-semibold text-ink">{p.name}</div>
                  {p.rating !== undefined && (
                    <div className="text-xs text-ink-muted">★ {p.rating.toFixed(1)}</div>
                  )}
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-bold text-ink">{formatINR(p.price)}</span>
                    <Link href={`/products/${p.id}`} className="rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink">
                      View →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 pb-14 md:grid-cols-2">
          <div className="rounded-card border border-slate-200 bg-surface p-8 shadow-soft">
            <h3 className="text-lg font-extrabold text-ink">YOUR MONEY. YOUR DECISION.</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              {["Price verified", "Stock verified", "Total verified", "Explicit payment confirmation"].map((t) => (
                <li key={t}>✓ {t}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-faint">Secure payments powered by Razorpay</p>
          </div>
          <div className="gradient-btn flex flex-col items-start justify-center rounded-card p-8 text-white">
            <h3 className="text-2xl font-extrabold">READY TO SHOP WITH AI?</h3>
            <p className="mt-1 text-sm text-white/80">Tell RazorPilot what you&apos;re looking for.</p>
            <Link href="/chat" className="mt-5 rounded-pill bg-lime px-6 py-2.5 text-sm font-bold text-ink">
              Start Shopping →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
