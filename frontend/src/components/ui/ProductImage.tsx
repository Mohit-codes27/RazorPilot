"use client";

import { useState } from "react";

const CATEGORY_GRADIENTS: Record<string, string> = {
  headphones: "from-blue-100 via-violet-100 to-purple-100",
  keyboards: "from-amber-100 via-orange-100 to-rose-100",
  mice: "from-emerald-100 via-teal-100 to-cyan-100",
  monitors: "from-indigo-100 via-blue-100 to-sky-100",
  accessories: "from-slate-100 via-gray-100 to-zinc-200",
};

const CATEGORY_ICONS: Record<string, string> = {
  headphones: "🎧",
  keyboards: "⌨️",
  mice: "🖱️",
  monitors: "🖥️",
  accessories: "🔌",
};

export function ProductImage({
  src,
  alt,
  categorySlug,
  className = "",
}: {
  src?: string | null;
  alt: string;
  categorySlug?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`object-cover ${className}`}
      />
    );
  }
  const gradient = (categorySlug && CATEGORY_GRADIENTS[categorySlug]) || "from-blue-50 via-violet-50 to-purple-50";
  const icon = (categorySlug && CATEGORY_ICONS[categorySlug]) || "📦";
  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex items-center justify-center bg-gradient-to-br ${gradient} ${className}`}
    >
      <span className="text-5xl">{icon}</span>
    </div>
  );
}
