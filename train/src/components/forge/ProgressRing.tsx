/**
 * PROGRESS RING — a proportion, read at a glance.
 *
 * Server-renderable: the arc is stroke-dashoffset on a circle with
 * `pathLength={1}`, so the value is expressed in the markup rather than
 * computed in the browser. The number always sits inside the ring, because the
 * ring is an aid to reading it, not a replacement for it.
 */
export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 4,
  label,
  children,
  className,
  tone = 'mint',
}: {
  /** 0 to 1. Clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Accessible description. The visible figure is `children`. */
  label: string;
  children?: React.ReactNode;
  className?: string;
  tone?: 'mint' | 'warn';
}) {
  const pct = Math.max(0, Math.min(1, value));
  const stroke = tone === 'warn' ? 'var(--color-status-progress)' : 'var(--color-mint)';

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${Math.round(pct * 100)}%`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90 size-full" fill="none">
        <circle
          cx="50"
          cy="50"
          r="46"
          stroke="var(--color-steel)"
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx="50"
          cy="50"
          r="46"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - pct}
          vectorEffect="non-scaling-stroke"
          style={{ transition: 'stroke-dashoffset var(--motion-build) var(--ease-forge)' }}
        />
      </svg>
      {children && <div className="relative z-1 text-center leading-none">{children}</div>}
    </div>
  );
}
