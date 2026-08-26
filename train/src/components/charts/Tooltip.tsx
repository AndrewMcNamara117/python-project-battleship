'use client';

import type { TooltipContentProps } from 'recharts';

type Row = { name?: string; value?: number | string; color?: string; dataKey?: string | number };

/**
 * Shared hover layer. Every chart ships one — an HTML chart is interactive by
 * default, and the tooltip carries the values that are deliberately not
 * direct-labelled on the marks.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: Omit<Partial<TooltipContentProps<number, string>>, 'formatter' | 'labelFormatter'> & {
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload as unknown as Row[];

  return (
    <div className="im-panel im-panel-raised min-w-[150px] px-3 py-2.5">
      {label != null && (
        <p className="im-micro mb-2 text-ink-secondary">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </p>
      )}
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-2 rounded-[1px]"
                style={{ background: r.color }}
              />
              <span className="text-[11px] text-ink-secondary">{r.name}</span>
            </span>
            <span className="im-mono text-[12px] font-bold text-ink-body">
              {formatter && typeof r.value === 'number'
                ? formatter(r.value, String(r.name))
                : String(r.value ?? '—')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
