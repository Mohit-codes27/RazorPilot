"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/login", { email, password });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push(params.get("next") || "/chat");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="text-center text-xl font-extrabold">✦ RAZOR<span className="gradient-text">PILOT</span></div>
      <h1 className="mt-6 text-center text-2xl font-extrabold text-ink">Welcome back</h1>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="rounded-xl border border-slate-200 bg-surface px-4 py-3 text-sm outline-none focus:border-accent-blue"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="rounded-xl border border-slate-200 bg-surface px-4 py-3 text-sm outline-none focus:border-accent-blue"
        />
        {error && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-danger">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="gradient-btn mt-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-accent-blue">
          Sign up
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-faint">
        Demo: demo@example.com / DemoPass123
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-6 py-24 text-center text-sm text-ink-muted">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
