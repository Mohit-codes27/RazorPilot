"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/register", { name, email, password });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/chat");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "rounded-xl border border-slate-200 bg-surface px-4 py-3 text-sm outline-none focus:border-accent-blue";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="text-center text-xl font-extrabold">✦ RAZOR<span className="gradient-text">PILOT</span></div>
      <h1 className="mt-6 text-center text-2xl font-extrabold text-ink">Create your account</h1>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={input} />
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} />
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 characters)"
          className={input}
        />
        {error && <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-danger">{error}</div>}
        <button
          type="submit"
          disabled={busy}
          className="gradient-btn mt-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Creating…" : "Sign up"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent-blue">
          Sign in
        </Link>
      </p>
    </div>
  );
}
