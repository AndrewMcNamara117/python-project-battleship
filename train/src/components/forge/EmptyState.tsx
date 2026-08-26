import type { ReactNode } from 'react';
import { TopoField } from './TopoField';

/**
 * EMPTY STATE — nothing here, said properly.
 *
 * Terrain fills the space a card would otherwise leave blank, and the copy
 * explains what will put something here rather than apologising. Nothing in
 * Iron Miles ever says "No data available".
 */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`im-panel im-panel-raised relative isolate overflow-hidden p-7 sm:p-9 ${className ?? ''}`}
    >
      <TopoField context="empty" safe="radial" offset={19} />
      <div className="relative z-1 max-w-[46ch]">
        <h3 className="im-display text-[1.3rem] text-ink">{title}</h3>
        <p className="mt-3.5 text-[14px] leading-relaxed text-ink-secondary">{body}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
