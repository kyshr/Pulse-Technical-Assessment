"use client";

import { useEffect, useRef, useState } from "react";

export default function VideoPanel({
  localStream,
  remoteStream,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Disabling a track sends silence / black frames without renegotiating.
  function toggle(kind: "audio" | "video") {
    const on = kind === "audio" ? !micOn : !camOn;
    localStream?.getTracks().forEach((t) => {
      if (t.kind === kind) t.enabled = on;
    });
    if (kind === "audio") setMicOn(on);
    else setCamOn(on);
  }

  const control =
    "grid size-12 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    // Full screen on mobile; beside the chat card on desktop.
    <section
      aria-label="Video call"
      className="animate-rise absolute inset-0 z-30 overflow-hidden bg-black md:inset-y-4 md:right-[432px] md:left-4 md:rounded-3xl md:border md:border-white/10"
    >
      <video ref={remoteRef} autoPlay playsInline className="size-full bg-zinc-950 object-cover" />
      {!remoteStream && (
        <div className="absolute inset-0 grid place-items-center text-sm text-zinc-400">
          <span className="animate-pulse">Waiting for their camera…</span>
        </div>
      )}

      {/* Self view, mirrored like a mirror. */}
      <video
        ref={localRef}
        autoPlay
        playsInline
        muted
        className={`absolute top-[max(1rem,env(safe-area-inset-top))] right-4 aspect-[3/4] w-28 -scale-x-100 rounded-2xl border border-white/15 bg-zinc-900 object-cover shadow-xl md:w-36 ${camOn ? "" : "opacity-0"}`}
      />

      <div className="glass absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full p-2">
        <button
          onClick={() => toggle("audio")}
          aria-pressed={!micOn}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
          className={`${control} ${micOn ? "bg-white/10 hover:bg-white/20" : "bg-white text-zinc-950"}`}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M19 10a7 7 0 0 1-14 0M12 17v5" />
            {!micOn && <path d="M3 3l18 18" />}
          </svg>
        </button>
        <button
          onClick={() => toggle("video")}
          aria-pressed={!camOn}
          aria-label={camOn ? "Turn camera off" : "Turn camera on"}
          className={`${control} ${camOn ? "bg-white/10 hover:bg-white/20" : "bg-white text-zinc-950"}`}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m16 13 5 3V8l-5 3" />
            <rect x="2" y="6" width="14" height="12" rx="2" />
            {!camOn && <path d="M3 3l18 18" />}
          </svg>
        </button>
        <button
          onClick={onEnd}
          className="min-h-12 rounded-full bg-red-500 px-6 text-sm whitespace-nowrap font-semibold text-white transition hover:bg-red-400"
        >
          End video
        </button>
      </div>
    </section>
  );
}
