/**
 * The Iron Miles mark — the exact supplied asset.
 * Two polygons, viewBox 0 0 780 660, identical to assets/images/favicon.svg
 * on ironmiles.ie. Never redraw, reinterpret or regenerate these paths.
 */
export function IronMilesMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 780 660"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <polygon points="9,17 131,130 131,628 9,628" fill="#eeeeee" />
      <polygon
        points="172,162 381,365 729,17 729,628 607,628 607,311 376,541 172,337"
        fill="#2dff8a"
      />
    </svg>
  );
}

/** Mark + wordmark lockup. */
export function IronMilesLogo({
  className,
  markClassName = 'h-6 w-auto',
  wordmark = true,
  sub,
}: {
  className?: string;
  markClassName?: string;
  wordmark?: boolean;
  sub?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <IronMilesMark className={markClassName} />
      {wordmark && (
        <span className="leading-none">
          <span className="block text-[13px] font-extrabold uppercase tracking-[0.22em]">
            Iron <span className="text-green">Miles</span>
          </span>
          {sub && (
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.32em] text-muted-2">
              {sub}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
