"use client";

import { useEffect, useRef, useState } from "react";

export default function VideoPanel({
  localStream,
  remoteStream,
  onEnd,
  onHide,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onEnd: () => void;
  onHide: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  // A stranger's video starts blurred; revealing applies to this stream only,
  // so a restarted video is blurred again.
  const [revealedStream, setRevealedStream] = useState<MediaStream | null>(null);
  const revealed = remoteStream !== null && revealedStream === remoteStream;

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
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        aria-hidden={!revealed}
        className={`size-full bg-zinc-950 object-cover transition-[filter] duration-500 ${revealed ? "" : "scale-110 blur-3xl"}`}
      />
      {!remoteStream && (
        <div className="absolute inset-0 grid place-items-center text-sm text-zinc-400">
          <span className="animate-pulse">Waiting for their camera…</span>
        </div>
      )}
      {remoteStream && !revealed && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="glass max-w-xs rounded-3xl p-5 text-center text-zinc-100">
            <p className="font-semibold">Their video is blurred</p>
            <p className="mt-1 text-sm text-zinc-400">
              You decide when to see a stranger. You can hear them already.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => setRevealedStream(remoteStream)}
                className="min-h-11 rounded-full bg-emerald-400 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-300"
              >
                Reveal
              </button>
              <button
                onClick={onHide}
                className="min-h-11 rounded-full bg-white/10 px-5 text-sm font-medium transition hover:bg-white/20"
              >
                Leave &amp; hide
              </button>
            </div>
          </div>
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
          onClick={() => setRevealedStream(revealed ? null : remoteStream)}
          disabled={!remoteStream}
          aria-pressed={!revealed}
          aria-label={revealed ? "Blur their video" : "Reveal their video"}
          title={revealed ? "Blur their video" : "Reveal their video"}
          className={`${control} disabled:opacity-40 ${revealed ? "bg-white/10 hover:bg-white/20" : "bg-white text-zinc-950"}`}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {!revealed && <path d="M3 3l18 18" />}
          </svg>
        </button>
        <button
          onClick={onHide}
          aria-label="Leave and hide this stranger"
          title="Leave and hide this stranger"
          className={`${control} bg-white/10 hover:bg-white/20`}
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            <path d="m9 9 6 6M15 9l-6 6" />
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
