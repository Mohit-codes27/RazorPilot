"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { useLogout, useMe } from "@/hooks/useAuth";
import type { UserPreferences } from "@/types/user";

function SettingsInner() {
  const { data: user } = useMe();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [budget, setBudget] = useState("");

  const { data: prefs } = useQuery({
    queryKey: ["preferences"],
    queryFn: () => api.get<{ preferences: UserPreferences }>("/users/me/preferences").then((r) => r.preferences),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch<{ preferences: UserPreferences }>("/users/me/preferences", {
        maxBudget: budget === "" ? null : Number(budget),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Couldn't save preferences"),
  });

  const current = prefs?.preferences as Record<string, unknown> | null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-extrabold text-ink">Settings</h1>

      <div className="mt-4 rounded-card border border-slate-200 bg-surface p-5 shadow-soft">
        <h2 className="font-bold text-ink">Profile</h2>
        <div className="mt-1 text-sm text-ink-soft">{user?.name}</div>
        <div className="text-sm text-ink-muted">{user?.email}</div>
      </div>

      <div className="mt-4 rounded-card border border-slate-200 bg-surface p-5 shadow-soft">
        <h2 className="font-bold text-ink">Shopping Preferences</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Maximum budget</dt>
            <dd className="font-semibold text-ink">
              {prefs?.maxBudget !== null && prefs?.maxBudget !== undefined
                ? `₹${Number(prefs.maxBudget).toLocaleString("en-IN")}`
                : "Not set"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Wireless</dt>
            <dd className="font-semibold text-ink">{current?.["wireless"] ? "Preferred" : "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Avoid</dt>
            <dd className="font-semibold text-ink">
              {Array.isArray(current?.["avoid"]) ? (current?.["avoid"] as string[]).join(", ") : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Priorities</dt>
            <dd className="font-semibold text-ink">
              {Array.isArray(current?.["priorities"]) ? (current?.["priorities"] as string[]).join(", ") : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center gap-2">
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="New max budget ₹"
            inputMode="numeric"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent-blue"
          />
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="gradient-btn shrink-0 rounded-pill px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {saved && <div className="mt-2 text-sm text-emerald-700">✓ Preferences saved</div>}
        {error && <div className="mt-2 text-sm text-danger">{error}</div>}
      </div>

      <div className="mt-4 rounded-card border border-slate-200 bg-surface p-5 shadow-soft">
        <h2 className="font-bold text-ink">Security & Account</h2>
        <button
          onClick={() => logout()}
          className="mt-3 w-full rounded-pill border border-slate-300 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <SettingsInner />
      </AppShell>
    </RequireAuth>
  );
}
