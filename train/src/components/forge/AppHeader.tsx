import type { ReactNode } from 'react';
import { TopoField } from './TopoField';

/**
 * APP HEADER — how every athlete screen opens.
 *
 * Terrain behind the title, masked away from the reading edge, then a hairline.
 * The eyebrow is the technical label; the title is the answer. Consistent
 * across the product so an athlete always knows where they are without reading
 * the navigation.
 */
export function AppHeader({
  eyebrow,
  title,
  lead,
  action,
  figure,
  topo = true,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  /** A single large number that belongs to the whole screen. */
  figure?: { value: ReactNode; label: string };
  topo?: boolean;
}) {
  return (
    <header className="relative isolate overflow-hidden border-b border-hairline pb-7">
      {topo && <TopoField context="header" safe="radial" offset={7} />}

      <div className="relative z-1 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          {eyebrow && <p className="im-micro">{eyebrow}</p>}
          <h1 className="im-display im-display-tight mt-3 text-[clamp(1.7rem,3.8vw,2.5rem)] text-ink">
            {title}
          </h1>
          {lead && (
            <p className="mt-3.5 max-w-[60ch] text-[14px] leading-relaxed text-ink-secondary">{lead}</p>
          )}
        </div>

        {figure && (
          <div className="text-right">
            <p className="im-figure text-[clamp(1.9rem,5vw,3rem)] text-mint">{figure.value}</p>
            <p className="im-micro mt-1.5">{figure.label}</p>
          </div>
        )}

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

/** Section divider inside a screen. Quieter than the page header. */
export function SectionHeading({
  label,
  action,
  className,
}: {
  label: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 ${className ?? ''}`}>
      <h2 className="im-micro-lg">{label}</h2>
      {action}
    </div>
  );
}
