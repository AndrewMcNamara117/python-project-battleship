/**
 * The Shannon — a slow, quiet line of water drifting across a section.
 * Purely decorative; static under prefers-reduced-motion (the drift
 * animation is gated behind html.tw-motion + the global reduced-motion
 * override).
 */
export default function ShannonLine({ className }: { className?: string }) {
  return (
    <svg
      className={`tw-river pointer-events-none w-full ${className ?? ""}`}
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 40 C 180 24, 360 56, 540 40 S 900 24, 1080 40 S 1350 56, 1440 40"
        fill="none"
        stroke="var(--color-emerald)"
        strokeWidth="1.5"
        strokeDasharray="140 60 60 60"
        opacity="0.5"
      />
      <path
        d="M0 58 C 240 44, 480 70, 720 58 S 1200 44, 1440 58"
        fill="none"
        stroke="var(--color-emerald)"
        strokeWidth="1"
        strokeDasharray="80 100 40 40"
        opacity="0.25"
      />
    </svg>
  );
}
