"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AgentActivity } from "@/types/agent";

export function ActivityDrawer({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["activity", sessionId],
    queryFn: () => api.get<{ data: AgentActivity[] }>(`/agent/sessions/${sessionId}/activity`),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <div
        className="flex h-full w-80 flex-col bg-surface p-5 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-ink">How RazorPilot decided</h3>
          <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink">
            ×
          </button>
        </div>
        <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
          {isLoading && <div className="skeleton h-24 rounded-card" />}
          {(data?.data ?? []).map((a, i) => (
            <div key={a.id ?? i} className="flex gap-2 text-sm">
              <span>{a.status === "failed" ? "✗" : a.type === "security_check" ? "🔒" : "✓"}</span>
              <div>
                <div className="font-medium text-ink">{a.label}</div>
                {a.timestamp && (
                  <div className="text-xs text-ink-faint">{new Date(a.timestamp).toLocaleTimeString()}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs text-ink-muted">
          🔒 Payment actions always require your confirmation.
        </p>
      </div>
    </div>
  );
}
