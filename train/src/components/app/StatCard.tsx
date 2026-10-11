import type { ReactNode } from 'react';
import { CountUp } from '@/components/motion/CountUp';
import { Panel } from '@/components/ui/Panel';

/**
 * Stat tile. A single number is a stat tile, never a one-bar chart —
 * the number is the chart.
 */
export function StatCard({
  label,
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  note,
  meter,
  children,
}: {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  note?: ReactNode;
  /** 0–1. Renders a hairline progress rule under the value. */
  meter?: number;
  children?: ReactNode;
}) {
  return (
    <Panel className="flex h-full flex-col p-6">
      <p className="im-micro">{label}</p>
      <p className="mt-3.5 text-[clamp(1.7rem,3.4vw,2.2rem)] font-extrabold leading-none">
        <CountUp to={value} decimals={decimals} suffix={suffix} prefix={prefix} />
      </p>
      {meter != null && (
        <div className="mt-4 h-px w-full bg-line-2">
          <div
            className="h-px bg-green transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ width: `${Math.min(100, Math.max(0, meter * 100))}%` }}
          />
        </div>
      )}
      {note && <p className="mt-3.5 text-[12px] leading-relaxed text-muted">{note}</p>}
      {children}
    </Panel>
  );
}
