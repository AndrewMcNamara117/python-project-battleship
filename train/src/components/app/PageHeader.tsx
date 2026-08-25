import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  lead,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-hairline pb-7">
      <div className="min-w-0">
        {eyebrow && <p className="im-eyebrow">{eyebrow}</p>}
        <h1 className="im-display mt-3 text-[clamp(1.8rem,4vw,2.6rem)]">{title}</h1>
        {lead && <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-ink-secondary">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function AppPage({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1180px] px-5 py-8 lg:px-8 lg:py-10">{children}</div>;
}
