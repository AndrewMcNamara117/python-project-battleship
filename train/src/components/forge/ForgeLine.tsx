import {
  areaPath,
  bars,
  describeSeries,
  linearPath,
  routePath,
  smoothPath,
  toPoints,
} from './path';

/**
 * THE FORGE LINE — the Iron Miles signature.
 *
 * One continuous accent line standing for an athlete's progression. It changes
 * meaning with context but never changes language:
 *
 *   route        a path through terrain              decorative
 *   elevation    course profile, terrain gained      data
 *   load         work accumulating week by week      data
 *   performance  trajectory against what was set     data
 *   race         the line arriving at a start line   data
 *
 * Built as plain SVG with CSS animation. A server component: no client
 * JavaScript at all, no canvas, no library, nothing measured from the DOM.
 * Paths carry `pathLength={1}`, so the draw is `stroke-dashoffset: 1 → 0`
 * regardless of real geometry — no path measurement, no layout read, no
 * resize handler.
 *
 * It deliberately does NOT wait for the line to scroll into view. An earlier
 * version gated the draw on an IntersectionObserver, which meant any line
 * below the fold rendered as nothing at all until scrolled to — and rendered
 * as nothing permanently without JavaScript. Motion may not gate information.
 * A CSS animation runs on load whether or not JavaScript does.
 *
 * Accessibility contract:
 *   - A ForgeLine is NEVER the only carrier of information. Every data instance
 *     sits beside the same figures in the DOM.
 *   - Decorative instances are aria-hidden. Data instances are role="img" with
 *     a plain-language summary.
 *   - Under prefers-reduced-motion the final state renders immediately — not a
 *     fade, not a delay. Motion never gates the numbers.
 */

export type ForgeLineVariant = 'route' | 'elevation' | 'load' | 'performance' | 'race';

export interface ForgeLineProps {
  variant?: ForgeLineVariant;
  /** The series. Omit for `route`, which is decorative. */
  data?: number[];
  /** A second, recessive series — what was prescribed, against what was done. */
  reference?: number[];
  /** Describes the data for screen readers. Omit to mark the line decorative. */
  label?: string;
  unit?: string;
  className?: string;
  height?: number;
  /** Mark the final point. Reads as "you are here". */
  showNode?: boolean;
  /** Area wash beneath the line. Default on for elevation and performance. */
  fill?: boolean;
  strokeWidth?: number;
  /** Deterministic shape for the decorative route variant. */
  seed?: number;
  /** Delay the entry, in ms, to stagger a group of lines. */
  delay?: number;
}

export function ForgeLine({
  variant = 'route',
  data,
  reference,
  label,
  unit = '',
  className,
  height,
  showNode,
  fill,
  strokeWidth,
  seed = 1,
  delay = 0,
}: ForgeLineProps) {
  // A stable id per instance without a hook, so this stays a server component.
  // Collisions only matter within a document, and variant + shape is enough.
  const uid = hashId(`${variant}-${(data ?? []).join(',')}-${label ?? ''}-${seed}`);

  const values = data ?? [];
  const hasData = values.length > 0;
  const isDecorative = variant === 'route' || !label;

  const wantsFill = fill ?? (variant === 'elevation' || variant === 'performance');
  const wantsNode = showNode ?? (variant === 'performance' || variant === 'race');
  const stroke = strokeWidth ?? (variant === 'performance' ? 2 : 1.6);

  /* ---- geometry ---- */
  const points = hasData ? toPoints(values) : [];
  const linePath =
    variant === 'route'
      ? routePath(seed)
      : variant === 'elevation' || variant === 'race'
        ? linearPath(points)
        : smoothPath(points);

  const refPoints = reference?.length ? toPoints(reference) : [];
  const refPath = refPoints.length ? smoothPath(refPoints) : '';

  const barGeometry = variant === 'load' && hasData ? bars(values) : [];
  const last = points[points.length - 1];

  const a11y = isDecorative
    ? ({ 'aria-hidden': true } as const)
    : ({
        role: 'img',
        'aria-label': describeSeries(values, unit, label ?? ''),
      } as const);

  // Reduced motion is handled in globals.css, where .im-anim-draw collapses to
  // its end state — the line is present either way.
  const animDelay = delay ? { animationDelay: `${delay}ms` } : undefined;

  if (variant !== 'route' && !hasData) {
    return (
      <div
        className={`flex items-center ${className ?? ''}`}
        style={height ? { height } : undefined}
        aria-hidden
      >
        <span className="h-px w-full bg-hairline" />
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      style={height ? { height } : undefined}
      fill="none"
      {...a11y}
    >
      <defs>
        <linearGradient id={`fl-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-mint)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--color-mint)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* what was prescribed — recessive, in steel, never a second hue */}
      {refPath && (
        <path
          d={refPath}
          stroke="var(--color-steel)"
          strokeWidth={1.4}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* BUILD — volume accumulating from the baseline */}
      {variant === 'load' &&
        barGeometry.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="0.8"
            fill="var(--color-mint)"
            // the figure above is the content; the bars are its shape, and must
            // not out-shout the number they belong to
            fillOpacity={0.62}
            className="im-anim-build"
            style={{
              // fill-box keeps the origin correct under preserveAspectRatio="none";
              // user-unit origins skew once the viewBox is stretched
              transformBox: 'fill-box',
              transformOrigin: 'bottom',
              animationDelay: `${delay + i * 45}ms`,
            }}
          />
        ))}

      {/* DRAW — the line advancing along its own length */}
      {variant !== 'load' && (
        <>
          {wantsFill && (
            <path
              d={areaPath(points.length ? points : [{ x: 0, y: 50 }], linePath)}
              fill={`url(#fl-fill-${uid})`}
              className="im-anim-forge"
              style={{ animationDelay: `${delay}ms` }}
            />
          )}
          <path
            d={linePath}
            stroke="var(--color-mint)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            className="im-anim-draw"
            style={animDelay}
          />
        </>
      )}

      {/* the endpoint: where the athlete is now. A surface-coloured ring keeps
          it legible wherever it lands on the line. */}
      {wantsNode && last && (
        <circle
          cx={last.x}
          cy={last.y}
          r="2.6"
          fill="var(--color-mint)"
          stroke="var(--color-charcoal)"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
          className="im-anim-complete"
          style={{ animationDelay: `${delay + 900}ms` }}
        />
      )}

      {/* the start line, for the race variant */}
      {variant === 'race' && last && (
        <>
          <line
            x1={last.x}
            y1="0"
            x2={last.x}
            y2="100"
            stroke="var(--color-steel)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
          <rect x={last.x} y={Math.max(0, last.y - 9)} width="7" height="5" fill="var(--color-mint)" />
        </>
      )}
    </svg>
  );
}


/** Small deterministic hash, so gradient ids are stable across server and client. */
function hashId(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
