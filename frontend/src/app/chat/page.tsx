"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { useMe } from "@/hooks/useAuth";

const SUGGESTIONS = [
  "Wireless headphones under ₹5,000",
  "Best keyboard for coding",
  "Compare gaming mice",
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function NewChatInner() {
  const router = useRouter();
  const { data: user } = useMe();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async (message: string) => {
    if (!message.trim() || busy) return;
    setBusy(true);
    try {
      const s = await api.post<{ session: { id: string } }>("/agent/sessions", {});
      sessionStorage.setItem(`rp-first-message:${s.session.id}`, message.trim());
      router.push(`/chat/${s.session.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-extrabold text-ink md:text-4xl">
        {greeting()}, {user?.name?.split(" ")[0] ?? "there"} 👋
      </h1>
      <p className="mt-2 text-ink-muted">What are you looking for today?</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(text);
        }}
        className="mt-6 flex w-full items-center gap-2 rounded-pill border border-slate-200 bg-surface p-2 pl-5 shadow-soft"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask RazorPilot anything..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
        />
        <button type="submit" disabled={busy} className="gradient-btn rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          ➤
        </button>
      </form>
      <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Try asking</div>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => start(s)}
            className="rounded-pill border border-slate-200 bg-surface px-4 py-2 text-sm text-ink-soft hover:border-accent-blue hover:text-accent-blue"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NewChatPage() {
  return (
    <RequireAuth>
      <AppShell>
        <NewChatInner />
      </AppShell>
    </RequireAuth>
  );
}
