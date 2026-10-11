import type { ReactNode } from 'react';
import { Reveal } from '@/components/motion/Reveal';

export function Section({
  id,
  children,
  className,
  tone = 'base',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: 'base' | 'raised';
}) {
  return (
    <section
      id={id}
      className={[
        'im-grain relative overflow-hidden py-[clamp(72px,10vw,140px)]',
        tone === 'raised' ? 'bg-iron-2' : 'bg-iron',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="relative z-2 mx-auto max-w-[1240px] px-5">{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <Reveal
      className={[
        align === 'center' ? 'mx-auto text-center' : '',
        'max-w-[62ch]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {eyebrow && <p className="im-eyebrow">{eyebrow}</p>}
      <h2 className="im-display mt-4 text-[clamp(2rem,5.4vw,3.5rem)]">{title}</h2>
      {lead && (
        <p className="mt-5 text-[clamp(1rem,1.5vw,1.18rem)] leading-relaxed text-muted">{lead}</p>
      )}
    </Reveal>
  );
}
