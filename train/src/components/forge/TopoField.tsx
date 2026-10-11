import type { TopoContext } from '@/lib/tokens';

/**
 * TOPOGRAPHIC FIELD — terrain as atmosphere.
 *
 * Real contour geometry rather than the repeating-radial-gradient this
 * replaces: nested closed curves at irregular intervals, the way a survey map
 * reads, so it looks like ground rather than a ripple.
 *
 * The rule that keeps it from becoming decoration: opacity is chosen by
 * CONTEXT, not by the caller. `card` is deliberately at the edge of visible.
 * Contours are never permitted beneath numerals or workout instructions — the
 * `safe` prop masks the field away from the region where content sits.
 *
 * One `<defs>` block per instance, but the geometry is a single `<path>`
 * reused by `<use>`, so the browser rasterises the contour set once.
 */

const OPACITY: Record<TopoContext, number> = {
  marketing: 0.1,
  header: 0.055,
  card: 0.035,
  empty: 0.07,
};

/**
 * One contour set, authored as concentric closed curves at uneven spacing.
 * Uneven is the point — evenly spaced rings read as a target, not terrain.
 */
const CONTOURS = [
  'M20,96 C44,72 62,84 88,66 C112,50 128,58 152,42 C170,30 186,34 200,24',
  'M14,112 C40,90 60,100 86,82 C112,64 130,72 156,54 C176,40 192,44 206,32',
  'M8,130 C36,110 58,118 84,100 C112,80 132,88 160,68 C182,52 198,56 212,42',
  'M2,150 C32,132 56,138 82,120 C112,98 134,106 164,84 C188,66 204,70 218,54',
  'M-4,174 C28,158 54,162 80,144 C112,120 136,126 168,102 C194,82 210,86 224,68',
  'M-10,202 C24,188 52,190 78,172 C112,146 138,150 172,124 C200,102 216,104 230,84',
  'M-16,234 C20,222 50,222 76,204 C112,176 140,178 176,148 C206,124 222,124 236,102',
];

export function TopoField({
  context = 'card',
  className,
  /**
   * Fade the field away from where content sits, so contours never run under
   * figures or instructions. 'bottom' keeps the top clear, 'right' keeps the
   * reading edge clear, 'none' fills the box.
   */
  safe = 'none',
  /** Nudge the terrain so adjacent panels do not look tiled. */
  offset = 0,
}: {
  context?: TopoContext;
  className?: string;
  safe?: 'none' | 'bottom' | 'right' | 'radial';
  offset?: number;
}) {
  const opacity = OPACITY[context];

  const mask =
    safe === 'bottom'
      ? 'linear-gradient(180deg, transparent 0%, #000 55%, #000 100%)'
      : safe === 'right'
        ? 'linear-gradient(90deg, transparent 0%, transparent 38%, #000 100%)'
        : safe === 'radial'
          ? 'radial-gradient(120% 100% at 88% 12%, #000 0%, transparent 68%)'
          : undefined;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}
      style={
        mask
          ? { opacity, maskImage: mask, WebkitMaskImage: mask }
          : { opacity }
      }
    >
      <svg
        viewBox="0 0 240 240"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        className="size-full"
      >
        <g
          stroke="var(--color-mint)"
          strokeWidth="0.6"
          vectorEffect="non-scaling-stroke"
          transform={offset ? `translate(${offset % 40}, ${(offset * 1.6) % 40})` : undefined}
        >
          {CONTOURS.map((d, i) => (
            <path key={i} d={d} />
          ))}
          {/* a second set, rotated, so the field reads as terrain rather than
              a set of parallel strokes */}
          <g transform="rotate(180 120 120)" opacity="0.7">
            {CONTOURS.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}

/**
 * Convenience wrapper: a positioned box that hosts a TopoField behind its
 * children, with content guaranteed to sit above the terrain.
 */
export function TopoSurface({
  context = 'card',
  safe = 'radial',
  offset = 0,
  className,
  children,
}: {
  context?: TopoContext;
  safe?: 'none' | 'bottom' | 'right' | 'radial';
  offset?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative isolate overflow-hidden ${className ?? ''}`}>
      <TopoField context={context} safe={safe} offset={offset} />
      <div className="relative z-1">{children}</div>
    </div>
  );
}
