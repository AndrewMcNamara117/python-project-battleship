import type { ElementType, ReactNode } from 'react';

/** Any tag or component that accepts a className and children. */
type PanelTag = ElementType<{ className?: string; children?: ReactNode }>;

export function Panel({
  as: Tag = 'div',
  children,
  className,
  edge = false,
  raised = true,
  hover = false,
}: {
  as?: PanelTag;
  children: ReactNode;
  className?: string;
  edge?: boolean;
  raised?: boolean;
  hover?: boolean;
}) {
  return (
    <Tag
      className={[
        'im-panel',
        raised && 'im-panel-raised',
        hover && 'im-panel-hover',
        edge && 'im-edge overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  label,
  action,
  className,
}: {
  label: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className ?? ''}`}>
      <h2 className="im-micro">{label}</h2>
      {action}
    </div>
  );
}
