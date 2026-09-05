"use client";

import { ApiError } from "@/lib/api";
import { useLogout, useMe } from "@/hooks/useAuth";
import { useEffect, type ReactNode } from "react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useMe();
  const logout = useLogout();

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      logout();
    }
  }, [isLoading, isError, user, logout]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-6">
        <div className="skeleton h-16 rounded-card" />
        <div className="skeleton h-32 rounded-card" />
        <div className="skeleton h-16 rounded-card" />
      </div>
    );
  }
  if (isError || !user) return null;
  return <>{children}</>;
}

export function AuthErrorNote({ error }: { error: unknown }) {
  const message = error instanceof ApiError ? error.message : "Something went wrong";
  return <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-danger">{message}</div>;
}
