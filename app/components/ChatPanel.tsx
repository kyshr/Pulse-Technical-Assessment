"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

const ICEBREAKERS = [
  "Hey! What's it like where you are?",
  "What time is it there right now?",
  "Best thing that happened to you today?",
];

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
  onHide,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
  onHide: () => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (connected) inputRef.current?.focus();
  }, [connected]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  return (
    // Bottom sheet on mobile, floating card on desktop.
    <section
      aria-label="Chat with stranger"
      className="glass animate-rise absolute inset-x-0 bottom-0 z-20 flex h-[62dvh] flex-col rounded-t-3xl pb-[env(safe-area-inset-bottom)] text-zinc-100 md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:h-auto md:w-[400px] md:rounded-3xl md:pb-0"
    >
      <header className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <div className="relative size-10 shrink-0 rounded-full bg-[conic-gradient(from_200deg,#34d399,#22d3ee,#818cf8,#34d399)]">
          <span
            className={`absolute right-0 bottom-0 size-3 rounded-full border-2 border-[#0c0e16] ${connected ? "bg-emerald-400" : "animate-pulse bg-amber-400"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Stranger</p>
          <p className="text-xs text-zinc-400">
            {connected ? "Connected · peer-to-peer" : "Opening a private line…"}
          </p>
        </div>
        <button
          onClick={onStartVideo}
          disabled={!connected || videoBusy}
          aria-label="Start video call"
          title="Start video call"
          className="grid size-11 place-items-center rounded-full bg-white/5 transition hover:bg-white/10 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m16 13 5 3V8l-5 3" />
            <rect x="2" y="6" width="14" height="12" rx="2" />
          </svg>
        </button>
        <button
          onClick={onHide}
          aria-label="Leave and hide this stranger"
          title="Leave and hide this stranger"
          className="grid size-11 place-items-center rounded-full bg-white/5 transition hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            <path d="m9 9 6 6M15 9l-6 6" />
          </svg>
        </button>
        <button
          onClick={onEnd}
          className="min-h-11 rounded-full bg-red-500/90 px-4 text-sm font-semibold text-white transition hover:bg-red-500"
        >
          End
        </button>
      </header>

      <div role="log" aria-live="polite" className="flex-1 space-y-1.5 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            {connected ? (
              <>
                <div>
                  <p className="text-lg font-semibold">You&rsquo;re connected 👋</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Messages go straight to them and are never stored.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  {ICEBREAKERS.map((q) => (
                    <button
                      key={q}
                      onClick={() => onSend(q)}
                      className="rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-200 transition hover:border-emerald-400/50 hover:bg-emerald-400/10"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-400">Finding the shortest path between you two…</p>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`animate-rise flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <span
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug break-words ${
                m.mine
                  ? "rounded-br-md bg-emerald-400 text-zinc-950"
                  : "rounded-bl-md bg-white/10 text-zinc-100"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-white/5 p-3">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Say something…" : "Connecting…"}
          aria-label="Message"
          maxLength={1000}
          disabled={!connected}
          className="min-h-11 flex-1 rounded-full bg-white/5 px-4 text-[15px] outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          aria-label="Send"
          className="grid size-11 place-items-center rounded-full bg-emerald-400 text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
    </section>
  );
}
