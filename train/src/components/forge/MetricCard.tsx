import type { ReactNode } from 'react';
import { CountUp } from '@/components/motion/CountUp';
import { Panel } from '@/components/ui/Panel';

/**
 * METRIC CARD — one number, read fast.
 *
 * The figure is the content. Everything else is subordinate: the label sits
 * above in small tracked caps, any supporting line sits below in secondary ink,
 * and an optional ForgeLine or meter goes beneath that. Numerals are tabular so
 * a value changing does not shift the layout.
 */
export function MetricCard({
  label,
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  note,
  meter,
  children,
  className,
  emphasis = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  note?: ReactNode;
  /** 0–1. A hairline proportion rule under the figure. */
  meter?: number;
  children?: ReactNode;
  className?: string;
  /** Raise the figure size for the one metric that matters most on a screen. */
  emphasis?: boolean;
}) {
  return (
    <Panel className={`flex h-full flex-col p-5 sm:p-6 ${className ?? ''}`}>
      <p className="im-micro">{label}</p>

      <p
        className={`im-figure mt-3.5 ${
          emphasis ? 'text-[clamp(2.1rem,4.4vw,2.7rem)]' : 'text-[clamp(1.65rem,3.2vw,2.05rem)]'
        }`}
      >
        <CountUp to={value} decimals={decimals} suffix={suffix} prefix={prefix} />
      </p>

      {meter != null && (
        <div className="mt-4 h-px w-full bg-steel" aria-hidden>
          <div
            className="h-px bg-mint transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${Math.min(100, Math.max(0, meter * 100))}%` }}
          />
        </div>
      )}

      {note && <p className="mt-3.5 text-[12px] leading-relaxed text-ink-secondary">{note}</p>}
      {children}
    </Panel>
  );
}
