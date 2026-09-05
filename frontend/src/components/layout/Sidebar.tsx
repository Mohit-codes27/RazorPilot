"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCart } from "@/hooks/useCart";
import { useLogout, useMe } from "@/hooks/useAuth";
import type { AgentSession } from "@/types/agent";

const NAV = [
  { href: "/discover", label: "Discover", icon: "◉" },
  { href: "/chat", label: "AI Shopping", icon: "✦" },
  { href: "/cart", label: "Cart", icon: "🛒" },
  { href: "/orders", label: "Orders", icon: "📦" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: user } = useMe();
  const { data: cart } = useCart(!!user);
  const logout = useLogout();
  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => api.get<{ data: AgentSession[] }>("/agent/sessions").then((r) => r.data),
    enabled: !!user,
    retry: false,
  });

  const newChat = async () => {
    const s = await api.post<{ session: { id: string } }>("/agent/sessions", {});
    router.push(`/chat/${s.session.id}`);
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-surface md:flex">
      <div className="p-4">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-ink">
          ✦ RAZOR<span className="gradient-text">PILOT</span>
        </Link>
        <button
          onClick={newChat}
          className="gradient-btn mt-4 w-full rounded-pill px-4 py-2.5 text-sm font-semibold text-white"
        >
          ✦ New Chat
        </button>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV.map((n) => {
          const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                active ? "bg-blue-50 text-accent-blue" : "text-ink-soft hover:bg-slate-100"
              }`}
            >
              <span>{n.icon}</span>
              {n.label}
              {n.href === "/cart" && (cart?.itemCount ?? 0) > 0 && (
                <span className="ml-auto rounded-full bg-accent-blue px-2 py-0.5 text-xs font-bold text-white">
                  {cart?.itemCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-slate-200 px-5 pt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Recent Chats</div>
        <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
          {(sessions ?? []).slice(0, 6).map((s) => (
            <Link
              key={s.id}
              href={`/chat/${s.id}`}
              className="truncate rounded-lg px-2 py-1.5 text-sm text-ink-soft hover:bg-slate-100"
            >
              {s.preview || "New conversation"}
            </Link>
          ))}
          {(sessions ?? []).length === 0 && (
            <div className="px-2 py-1.5 text-sm text-ink-faint">No recent chats</div>
          )}
        </div>
      </div>
      <div className="mt-auto border-t border-slate-200 p-4">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-slate-100"
        >
          ⚙ Settings
        </Link>
        <div className="mt-2 flex items-center justify-between px-3 py-1">
          <span className="truncate text-sm font-medium text-ink">{user?.name ?? "…"}</span>
          <button onClick={() => logout()} className="text-xs font-semibold text-ink-muted hover:text-danger">
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
