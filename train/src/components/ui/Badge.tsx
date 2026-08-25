import type { ReactNode } from 'react';

const tones = {
  green: 'border-green/35 text-green bg-green/8',
  neutral: 'border-line-2 text-muted bg-white/3',
  warn: 'border-warn/35 text-warn bg-warn/8',
  alert: 'border-alert/40 text-alert bg-alert/8',
  solid: 'border-transparent bg-green text-green-deep',
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-xs border px-2 py-1',
        'text-[9px] font-bold uppercase tracking-[0.2em] leading-none whitespace-nowrap',
        tones[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = 'green' }: { tone?: 'green' | 'warn' | 'alert' | 'muted' }) {
  const map = { green: 'bg-green', warn: 'bg-warn', alert: 'bg-alert', muted: 'bg-muted-2' };
  return <span className={`inline-block size-1.5 rounded-full ${map[tone]}`} aria-hidden />;
}
