"use client";

import { useState } from "react";

export function ChatInput({
  onSend,
  sending,
  placeholder = "Ask RazorPilot anything...",
}: {
  onSend: (text: string) => void;
  sending: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || sending) return;
        onSend(text.trim());
        setText("");
      }}
      className="flex items-center gap-2 rounded-pill border border-slate-200 bg-surface p-2 pl-5 shadow-soft"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
      />
      <button
        type="submit"
        disabled={sending || !text.trim()}
        className="gradient-btn rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {sending ? "…" : "➤"}
      </button>
    </form>
  );
}
