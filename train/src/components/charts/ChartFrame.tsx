import type { ReactNode } from 'react';

/**
 * Every chart sits in the same frame: a title that names what is plotted
 * (so a single-series chart needs no legend), an optional unit note, and a
 * fixed-height plot area. Wide plots scroll inside their own container.
 */
export function ChartFrame({
  title,
  note,
  legend,
  height = 220,
  children,
  className,
}: {
  title: string;
  note?: string;
  legend?: ReactNode;
  height?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={className}>
      <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h3 className="im-micro">{title}</h3>
          {note && <p className="mt-1.5 text-[11px] text-ink-tertiary">{note}</p>}
        </div>
        {legend}
      </figcaption>
      <div style={{ height }} className="w-full min-w-0">
        {children}
      </div>
    </figure>
  );
}

/** Legend key — the dependable identity channel whenever two series share a plot. */
export function LegendKey({
  items,
}: {
  items: { label: string; color: string; mark?: 'bar' | 'line' }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block"
            style={
              i.mark === 'line'
                ? { width: 14, height: 2, background: i.color, borderRadius: 2 }
                : { width: 8, height: 10, background: i.color, borderRadius: 2 }
            }
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-secondary">
            {i.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
