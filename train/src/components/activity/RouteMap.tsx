import { decodeRoute, projectRoute } from '@/lib/activity/route';

/**
 * The route, drawn as one line.
 *
 * No basemap. Map tiles would mean a third-party request carrying where the
 * athlete runs on every page view, and the product's own palette replaced by
 * someone else's. What a coach needs from the route is its shape and its
 * hills, and the line carries both. A server component: plain SVG, drawn by
 * the shared DRAW stage, complete at once under reduced motion.
 *
 * The start is a hollow node and the finish a solid one — but both sit where
 * the visible line begins and ends, which is after the privacy trim, never at
 * the door.
 */
export function RouteMap({
  route,
  label,
  trimM,
  className,
  height = 320,
  compact = false,
  caption,
}: {
  route: string | null;
  label: string;
  trimM: number;
  className?: string;
  height?: number;
  /** A thumbnail: no nodes, no caption. */
  compact?: boolean;
  /** Replaces the privacy line — for a segment, which is a public stretch, not someone's run. */
  caption?: string;
}) {
  const width = Math.round(height * 1.4);
  const segments = decodeRoute(route);
  const { paths, start, end } = projectRoute(segments, width, height, compact ? 6 : 18);

  if (!paths.length) {
    return compact ? (
      <div className={`grid place-items-center bg-onyx ${className ?? ''}`} aria-hidden>
        <span className="h-px w-1/2 bg-hairline" />
      </div>
    ) : (
      <div className={`grid place-items-center bg-onyx px-6 text-center ${className ?? ''}`} style={{ minHeight: height / 2 }}>
        <p className="max-w-xs text-[13px] leading-relaxed text-ink-secondary">
          {trimM > 0
            ? `No route to show. Either the file had no GPS, or the run was shorter than the ${trimM * 2} m your privacy setting hides.`
            : 'No route to show — the file had no GPS.'}
        </p>
      </div>
    );
  }

  return (
    <figure className={`relative bg-onyx ${className ?? ''}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={compact ? 'block h-full w-full' : 'block h-auto w-full'}
        // a thumbnail sits beside the same facts in text, so it is decoration there
        {...(compact ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
        fill="none"
      >
        {/* a quiet grid so scale reads without a map */}
        {!compact && (
          <g stroke="var(--color-hairline)" strokeWidth={1}>
            {Array.from({ length: 7 }, (_, i) => (
              <line key={`v${i}`} x1={(width / 7) * i} x2={(width / 7) * i} y1={0} y2={height} />
            ))}
            {Array.from({ length: 5 }, (_, i) => (
              <line key={`h${i}`} x1={0} x2={width} y1={(height / 5) * i} y2={(height / 5) * i} />
            ))}
          </g>
        )}
        {paths.map((d, i) => (
          <g key={i}>
            {!compact && <path d={d} stroke="var(--color-mint)" strokeOpacity={0.14} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />}
            <path
              d={d}
              pathLength={1}
              className="im-anim-draw"
              stroke="var(--color-mint)"
              strokeWidth={compact ? 1.6 : 2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}
        {!compact && start && (
          <circle cx={start[0]} cy={start[1]} r={4.5} stroke="var(--color-mint)" strokeWidth={1.6} fill="var(--color-onyx)" />
        )}
        {!compact && end && <circle cx={end[0]} cy={end[1]} r={4.5} fill="var(--color-mint)" />}
      </svg>
      {!compact && (
        <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline px-4 py-2.5 text-[11px] text-ink-tertiary">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full border border-mint" aria-hidden /> Start
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-mint" aria-hidden /> Finish
            </span>
          </span>
          <span>
            {caption ?? (trimM > 0 ? `First and last ${trimM} m hidden for privacy` : 'Full route shown — privacy trim is off')}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
