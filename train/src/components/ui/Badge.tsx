import type { ReactNode } from 'react';

const tones = {
  green: 'border-mint/35 text-mint bg-mint/8',
  neutral: 'border-hairline-strong text-ink-secondary bg-white/3',
  warn: 'border-status-progress/35 text-status-progress bg-status-progress/8',
  alert: 'border-status-missed/40 text-status-missed bg-status-missed/8',
  solid: 'border-transparent bg-mint text-mint-deep',
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
  const map = { green: 'bg-mint', warn: 'bg-status-progress', alert: 'bg-status-missed', muted: 'bg-ink-faint' };
  return <span className={`inline-block size-1.5 rounded-full ${map[tone]}`} aria-hidden />;
}
