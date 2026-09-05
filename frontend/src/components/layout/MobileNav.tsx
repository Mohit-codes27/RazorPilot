"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/hooks/useCart";
import { useMe } from "@/hooks/useAuth";

const NAV = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/discover", label: "Search", icon: "🔍" },
  { href: "/cart", label: "Cart", icon: "🛒" },
  { href: "/orders", label: "Orders", icon: "📦" },
];

export function MobileNav() {
  const pathname = usePathname();
  const { data: user } = useMe();
  const { data: cart } = useCart(!!user);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-surface/95 backdrop-blur md:hidden">
      {NAV.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              active ? "text-accent-blue" : "text-ink-muted"
            }`}
          >
            <span className="text-lg">{n.icon}</span>
            {n.label}
            {n.href === "/cart" && (cart?.itemCount ?? 0) > 0 && (
              <span className="absolute right-1/2 top-1 translate-x-4 rounded-full bg-accent-blue px-1.5 text-[10px] font-bold text-white">
                {cart?.itemCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
