"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityDrawer } from "@/components/agent/ActivityDrawer";
import { AssistantTurn, UserBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import type { AgentMessage, AgentResponse } from "@/types/agent";

type Turn = { kind: "user"; text: string } | { kind: "assistant"; turn: AgentResponse };

function Conversation() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const queryClient = useQueryClient();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);

  const { data: history } = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: () =>
      api.get<{ data: AgentMessage[] }>(`/agent/sessions/${sessionId}/messages`).then((r) => r.data),
    retry: false,
  });

  useEffect(() => {
    if (history && !initRef.current) {
      initRef.current = true;
      setTurns(
        history.map((m) =>
          m.role === "USER"
            ? { kind: "user" as const, text: m.content }
            : {
                kind: "assistant" as const,
                turn: {
                  sessionId,
                  session_id: sessionId,
                  messageId: m.id,
                  message: m.content,
                  type: "text" as const,
                  tool_calls: [],
                },
              },
        ),
      );
      const first = sessionStorage.getItem(`rp-first-message:${sessionId}`);
      if (first) {
        sessionStorage.removeItem(`rp-first-message:${sessionId}`);
        void send(first);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, sending]);

  const send = async (text: string, confirmed = false) => {
    setError("");
    setSending(true);
    setTurns((t) => [...t, { kind: "user", text }]);
    try {
      const res = await api.post<AgentResponse>(`/agent/sessions/${sessionId}/messages`, {
        message: text,
        confirmed,
      });
      setTurns((t) => [...t, { kind: "assistant", turn: res }]);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["activity", sessionId] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach RazorPilot. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-0px)] max-w-3xl flex-col px-4 pb-4 pt-4 md:h-screen">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-bold text-ink">✦ AI Shopping</h1>
        <button
          onClick={() => setDrawer(true)}
          className="rounded-pill border border-slate-200 bg-surface px-4 py-1.5 text-xs font-semibold text-ink-soft hover:border-accent-violet hover:text-accent-violet"
        >
          How RazorPilot decided
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto pb-4">
        {turns.map((t, i) =>
          t.kind === "user" ? (
            <UserBubble key={i} text={t.text} />
          ) : (
            <AssistantTurn key={t.turn.messageId || i} turn={t.turn} />
          ),
        )}
        {sending && (
          <div className="animate-fade-up text-sm text-ink-muted">
            <span className="font-bold text-accent-violet">✦ RazorPilot is thinking…</span>
            <div className="mt-1">🔎 Searching products…</div>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-danger">
            {error}{" "}
            <button onClick={() => setError("")} className="font-semibold underline">
              Dismiss
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={(t) => send(t)} sending={sending} />
      {drawer && <ActivityDrawer sessionId={sessionId} onClose={() => setDrawer(false)} />}
    </div>
  );
}

export default function ChatSessionPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Conversation />
      </AppShell>
    </RequireAuth>
  );
}
