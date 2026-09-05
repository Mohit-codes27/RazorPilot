import Link from "next/link";

export function EmptyState({
  title,
  body,
  actionLabel,
  actionHref,
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-slate-200 bg-surface px-6 py-16 text-center shadow-soft">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue/10 to-accent-violet/10 text-2xl">
        ✦
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>
      <Link
        href={actionHref}
        className="gradient-btn mt-6 rounded-pill px-6 py-2.5 text-sm font-semibold text-white shadow-soft"
      >
        {actionLabel}
      </Link>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-red-100 bg-surface px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-ink">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-pill border border-slate-300 px-5 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-slate-200 bg-surface p-4">
          <div className="skeleton aspect-square rounded-xl" />
          <div className="skeleton mt-3 h-4 w-3/4 rounded" />
          <div className="skeleton mt-2 h-4 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
