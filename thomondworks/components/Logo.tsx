import type { CSSProperties } from "react";

type MarkVariant = "brand" | "mono" | "white" | "emerald" | "bronze";

const STRUCTURE: Record<MarkVariant, string> = {
  brand: "var(--color-bronze)",
  mono: "currentColor",
  white: "var(--color-bone)",
  emerald: "var(--color-emerald)",
  bronze: "var(--color-bronze)",
};

const WATER: Record<MarkVariant, string> = {
  brand: "var(--color-emerald)",
  mono: "currentColor",
  white: "var(--color-bone)",
  emerald: "var(--color-emerald)",
  bronze: "var(--color-bronze)",
};

/**
 * The Thomond Works mark — the arches of Thomond Bridge over the Shannon.
 * Deck lines, a central structural pier, twin arches and three river lines.
 * Path classes (bm-*) are targeted by the intro assembly animation.
 */
export function BridgeMark({
  variant = "brand",
  className,
  style,
  title,
}: {
  variant?: MarkVariant;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const s = STRUCTURE[variant];
  const w = WATER[variant];
  return (
    <svg
      viewBox="0 0 120 90"
      fill="none"
      className={className}
      style={style}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <g stroke={s} strokeWidth="3.25">
        <path className="bm-deck1" d="M4 5.5 H116" />
        <path className="bm-deck2" d="M4 13.5 H116" />
        <path className="bm-pier-l" d="M5.625 13.5 V58" />
        <path className="bm-pier-r" d="M114.375 13.5 V58" />
        <path className="bm-arch-l" d="M19 59 V41 A15.5 15.5 0 0 1 50 41 V59" />
        <path className="bm-arch-r" d="M70 59 V41 A15.5 15.5 0 0 1 101 41 V59" />
        <path className="bm-stem" d="M60 13.5 V58" />
        <path className="bm-base" d="M4 59.5 H116" />
      </g>
      <g stroke={w} strokeWidth="3">
        <path className="bm-water" d="M26 71 Q60 66.5 94 71" />
        <path className="bm-water" d="M37 79.5 Q60 76.5 83 79.5" />
        <path className="bm-water" d="M49 87 Q60 85.5 71 87" />
      </g>
    </svg>
  );
}

/**
 * Horizontal lockup — used in the header.
 */
export function LogoHorizontal({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <BridgeMark className="h-8 w-auto shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[1.05rem] font-normal tracking-[0.14em] text-bone">
          THOMOND
        </span>
        <span className="mt-1 text-[0.55rem] font-semibold tracking-[0.52em] text-emerald-bright">
          WORKS
        </span>
      </span>
    </span>
  );
}

/**
 * Full stacked lockup — mark above wordmark with bronze rules.
 * Used in the footer and the animated intro.
 */
export function LogoLockup({
  className,
  markClassName = "h-20 w-auto",
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex flex-col items-center gap-6 ${className ?? ""}`}>
      <BridgeMark className={markClassName} />
      <span className="flex flex-col items-center leading-none">
        <span className="font-serif text-[clamp(1.8rem,4vw,2.6rem)] tracking-[0.18em] text-bone">
          THOMOND
        </span>
        <span className="mt-3 flex w-full items-center gap-4">
          <span className="h-px flex-1 bg-bronze/60" aria-hidden />
          <span className="text-[0.7rem] font-semibold tracking-[0.6em] text-emerald-bright">
            WORKS
          </span>
          <span className="h-px flex-1 bg-bronze/60" aria-hidden />
        </span>
      </span>
    </span>
  );
}
