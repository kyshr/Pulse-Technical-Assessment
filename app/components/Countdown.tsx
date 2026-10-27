// A ring that drains over `ms`. Purely visual; the real timeout lives in page.tsx.
export default function Countdown({ ms }: { ms: number }) {
  return (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0 -rotate-90" aria-hidden>
      <circle cx="10" cy="10" r="8" fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="2.5" />
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="#34d399"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={100}
        style={{ animation: `countdown ${ms}ms linear forwards` }}
      />
    </svg>
  );
}
