import Image from 'next/image';

/**
 * THE IRON MILES MARK — IMMUTABLE.
 *
 * These components reference the official asset files directly. They do not
 * draw the mark.
 *
 *   public/brand/iron-miles-mark.svg              the supplied file, byte-for-byte
 *   public/brand/iron-miles-mark-transparent.svg  the same file with only the
 *                                                 opaque #080808 background
 *                                                 rectangle removed
 *
 * The two polygons — their points, fills, proportions, angles, and the
 * relationship between the white element and the mint one — are identical in
 * both files and identical to the supplied original.
 *
 * NEVER redraw, reconstruct, approximate, or re-derive this mark in code. Never
 * rebuild it as inline SVG, CSS, canvas or a font glyph. If the mark needs to
 * change, the asset file changes and these components follow it. This rule is
 * permanent and applies across the entire Iron Miles Training product.
 */

const MARK = '/brand/iron-miles-mark-transparent.svg';
const MARK_PLATED = '/brand/iron-miles-mark.svg';

/** Intrinsic aspect of the official asset: viewBox 0 0 780 660. */
const ASPECT = 780 / 660;

export function IronMilesMark({
  className,
  title,
  /** Use the supplied file complete with its own #080808 plate. */
  plated = false,
  /** Rendered height in px. Width follows the official aspect ratio. */
  height = 26,
  priority = false,
}: {
  className?: string;
  title?: string;
  plated?: boolean;
  height?: number;
  priority?: boolean;
}) {
  return (
    <Image
      src={plated ? MARK_PLATED : MARK}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      height={height}
      width={Math.round(height * ASPECT)}
      className={className}
      priority={priority}
      // an SVG has no raster sizes to negotiate
      unoptimized
    />
  );
}

/**
 * Mark plus wordmark. The wordmark is set in Montserrat — it is typography,
 * not part of the mark, and may be composed freely around it.
 */
export function IronMilesLogo({
  className,
  markHeight = 24,
  wordmark = true,
  sub,
  priority = false,
}: {
  className?: string;
  markHeight?: number;
  wordmark?: boolean;
  sub?: string;
  priority?: boolean;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <IronMilesMark height={markHeight} priority={priority} />
      {wordmark && (
        <span className="leading-none">
          <span className="block text-[13px] font-bold uppercase tracking-[0.22em] text-ink-body">
            Iron <span className="text-mint">Miles</span>
          </span>
          {sub && (
            <span className="mt-1.5 block text-[9px] font-bold uppercase tracking-[0.3em] text-ink-secondary">
              {sub}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
