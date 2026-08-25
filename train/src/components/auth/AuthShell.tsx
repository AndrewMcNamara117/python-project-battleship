import type { ReactNode } from 'react';
import Link from 'next/link';
import { IronMilesMark } from '@/components/brand/IronMilesLogo';
import { Panel } from '@/components/ui/Panel';
import { RouteLine } from '@/components/motion/RouteLine';

export function AuthShell({
  eyebrow,
  title,
  lead,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="im-grain relative mx-auto grid max-w-[1240px] gap-14 px-5 py-[clamp(56px,8vw,110px)] lg:grid-cols-2 lg:items-center lg:gap-20">
      <div>
        <IronMilesMark height={40} title="Iron Miles" />
        <p className="im-eyebrow mt-8">{eyebrow}</p>
        <h1 className="im-display mt-5 text-[clamp(2.4rem,6vw,4rem)]">{title}</h1>
        <p className="mt-6 max-w-[42ch] text-[15px] leading-relaxed text-muted">{lead}</p>
        <RouteLine className="mt-12 hidden h-20 w-full max-w-[420px] lg:block" />
      </div>

      <Panel edge className="p-8 sm:p-10">
        {children}
        <div className="mt-8 border-t border-line pt-6 text-[13px] text-muted">{footer}</div>
      </Panel>
    </div>
  );
}

export function AuthAltLink({ href, label, cta }: { href: string; label: string; cta: string }) {
  return (
    <>
      {label}{' '}
      <Link href={href} className="font-bold text-white underline underline-offset-4 hover:text-green">
        {cta}
      </Link>
    </>
  );
}
