"use client";

import { useState } from "react";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => onReady(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      // High accuracy + maximumAge:0 forces a fresh fix (Wi-Fi/GPS scan)
      // instead of reusing the browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    // Sits over the spinning globe; the vignette keeps the text readable.
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-10 bg-[radial-gradient(ellipse_at_center,rgb(3_5_10/0.2)_0%,rgb(3_5_10/0.7)_55%,#03050a_100%)] p-6 text-center text-zinc-100">
      <div>
        <h1 className="flex items-center justify-center gap-4 text-6xl font-semibold tracking-tight sm:text-7xl">
          <span className="relative flex size-4" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-4 rounded-full bg-emerald-400" />
          </span>
          Pulse
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-lg text-balance text-zinc-300">
          A living globe of anonymous strangers. Tap a dot, start talking.
        </p>
      </div>

      <button
        onClick={enter}
        disabled={status === "locating"}
        className="rounded-full bg-emerald-400 px-10 py-4 text-lg font-semibold text-zinc-950 shadow-[0_0_48px_rgb(52_211_153/0.45)] transition hover:scale-105 hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 disabled:scale-100 disabled:opacity-60 motion-reduce:transition-none"
      >
        {status === "locating" ? "Finding you…" : "Enter Pulse"}
      </button>

      <p role="alert" className="max-w-sm text-sm text-red-400">
        {status === "error" ? error : null}
      </p>

      <p className="glass max-w-sm rounded-2xl px-4 py-3 text-xs text-zinc-400">
        No sign-up. Your dot is placed 1–3&nbsp;km from your real location.
        Nothing is stored — closing the tab ends everything.
      </p>
    </div>
  );
}
