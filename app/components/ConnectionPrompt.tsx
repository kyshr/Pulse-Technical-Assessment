"use client";

import { useEffect } from "react";
import Countdown from "./Countdown";

// Slide-in card for "someone wants to connect" and "someone wants to start
// video". Non-blocking: the globe stays usable behind it.
export default function ConnectionPrompt({
  title,
  subtitle,
  countdownMs,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  countdownMs?: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDecline();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDecline]);

  return (
    <div
      role="alertdialog"
      aria-labelledby="prompt-title"
      className="glass animate-slide-down absolute top-[max(1rem,env(safe-area-inset-top))] left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-3xl p-5 text-zinc-100"
    >
      <div className="flex items-start gap-3">
        <span className="relative mt-1 flex size-3 shrink-0" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex size-3 rounded-full bg-emerald-400" />
        </span>
        <div className="flex-1">
          <h2 id="prompt-title" className="font-semibold">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
        </div>
        {countdownMs && <Countdown ms={countdownMs} />}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onDecline}
          className="min-h-11 flex-1 rounded-full border border-white/10 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
        >
          Decline
        </button>
        <button
          autoFocus
          onClick={onAccept}
          className="min-h-11 flex-1 rounded-full bg-emerald-400 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
