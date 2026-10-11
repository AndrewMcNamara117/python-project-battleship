'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeekBucket, WellbeingPoint } from '@/lib/domain/analytics';
import { formatPace } from '@/lib/domain/dates';
import { ChartFrame, LegendKey } from './ChartFrame';
import { ChartTooltip } from './Tooltip';
import { AXIS_PROPS, CHART, GRID_PROPS, MARKS } from './tokens';

const cursor = { fill: 'rgba(238,238,238,0.04)' };

/* ------------------------------------------------------------------
   Weekly volume — measured against what was prescribed.
   Two series, so a legend is present; they also differ in mark type
   (columns vs line), which keeps identity off colour alone.
   ------------------------------------------------------------------ */
export function MileageChart({ data, height = 240 }: { data: WeekBucket[]; height?: number }) {
  return (
    <ChartFrame
      title="Weekly volume"
      note="Kilometres run each week against the prescribed total."
      height={height}
      legend={
        <LegendKey
          items={[
            { label: 'Completed', color: CHART.accent, mark: 'bar' },
            { label: 'Prescribed', color: CHART.reference, mark: 'line' },
          ]}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...AXIS_PROPS} width={44} />
          <Tooltip
            cursor={cursor}
            content={<ChartTooltip formatter={(v) => `${v} km`} labelFormatter={(l) => `Week of ${l}`} />}
          />
          <Bar
            dataKey="actualKm"
            name="Completed"
            fill={CHART.accent}
            maxBarSize={MARKS.barMaxWidth}
            radius={MARKS.barRadius}
          />
          <Line
            dataKey="plannedKm"
            name="Prescribed"
            stroke={CHART.reference}
            strokeWidth={MARKS.lineWidth}
            dot={false}
            activeDot={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------
   Long-run progression — one series, so no legend box; the title names it.
   ------------------------------------------------------------------ */
export function LongRunChart({ data, height = 200 }: { data: WeekBucket[]; height?: number }) {
  return (
    <ChartFrame
      title="Long-run progression"
      note="The longest single run of each week, in kilometres."
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="im-long-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={MARKS.areaOpacity * 2.2} />
              <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...AXIS_PROPS} width={44} />
          <Tooltip
            cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
            content={<ChartTooltip formatter={(v) => `${v} km`} labelFormatter={(l) => `Week of ${l}`} />}
          />
          <Area
            dataKey="longestRunKm"
            name="Longest run"
            type="monotone"
            stroke={CHART.accent}
            strokeWidth={MARKS.lineWidth}
            fill="url(#im-long-fill)"
            dot={false}
            activeDot={{
              r: MARKS.dotRadius,
              fill: CHART.accent,
              stroke: CHART.surface,
              strokeWidth: MARKS.ringWidth,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------
   Pace and heart rate are two different measures on two different scales,
   so they get two charts. Never one plot with two y-axes.
   ------------------------------------------------------------------ */
export function PaceChart({ data, height = 200 }: { data: WeekBucket[]; height?: number }) {
  const points = data.filter((d) => d.avgPaceSecPerKm != null);

  return (
    <ChartFrame
      title="Average pace"
      note="Mean pace across all runs in the week. Higher on the chart is faster."
      height={height}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={18} />
          <YAxis
            {...AXIS_PROPS}
            width={56}
            reversed
            domain={['dataMin - 12', 'dataMax + 12']}
            tickFormatter={(v: number) => formatPace(v ?? null).replace(' /km', '')}
          />
          <Tooltip
            cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
            content={<ChartTooltip formatter={(v) => formatPace(v)} labelFormatter={(l) => `Week of ${l}`} />}
          />
          <Line
            dataKey="avgPaceSecPerKm"
            name="Average pace"
            type="monotone"
            stroke={CHART.accent}
            strokeWidth={MARKS.lineWidth}
            dot={false}
            activeDot={{
              r: MARKS.dotRadius,
              fill: CHART.accent,
              stroke: CHART.surface,
              strokeWidth: MARKS.ringWidth,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function HeartRateChart({ data, height = 200 }: { data: WeekBucket[]; height?: number }) {
  const points = data.filter((d) => d.avgHr != null);

  return (
    <ChartFrame title="Average heart rate" note="Mean heart rate across the week's runs, in bpm." height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...AXIS_PROPS} width={44} domain={['dataMin - 6', 'dataMax + 6']} />
          <Tooltip
            cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
            content={<ChartTooltip formatter={(v) => `${v} bpm`} labelFormatter={(l) => `Week of ${l}`} />}
          />
          <Line
            dataKey="avgHr"
            name="Average HR"
            type="monotone"
            stroke={CHART.accent}
            strokeWidth={MARKS.lineWidth}
            dot={false}
            activeDot={{
              r: MARKS.dotRadius,
              fill: CHART.accent,
              stroke: CHART.surface,
              strokeWidth: MARKS.ringWidth,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function RpeChart({ data, height = 200 }: { data: WeekBucket[]; height?: number }) {
  const points = data.filter((d) => d.avgRpe != null);
  return (
    <ChartFrame title="Perceived effort" note="Mean RPE across all logged sessions, 1 to 10." height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={18} />
          <YAxis {...AXIS_PROPS} width={40} domain={[0, 10]} ticks={[0, 5, 10]} />
          <Tooltip
            cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
            content={<ChartTooltip formatter={(v) => `RPE ${v}`} labelFormatter={(l) => `Week of ${l}`} />}
          />
          <Line
            dataKey="avgRpe"
            name="Average RPE"
            type="monotone"
            stroke={CHART.accent}
            strokeWidth={MARKS.lineWidth}
            dot={false}
            activeDot={{
              r: MARKS.dotRadius,
              fill: CHART.accent,
              stroke: CHART.surface,
              strokeWidth: MARKS.ringWidth,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------
   Wellbeing: four measures that must be compared week to week.
   Faceted into small multiples rather than four competing hues on one plot —
   which keeps the brand to a single accent and keeps each trend readable.
   ------------------------------------------------------------------ */
const WELLBEING_FACETS = [
  { key: 'fatigue', label: 'Fatigue', hint: '10 = exhausted' },
  { key: 'sleep', label: 'Sleep', hint: '10 = excellent' },
  { key: 'soreness', label: 'Soreness', hint: '10 = severe' },
  { key: 'motivation', label: 'Motivation', hint: '10 = driven' },
] as const;

export function WellbeingSmallMultiples({ data }: { data: WellbeingPoint[] }) {
  if (!data.length) {
    return (
      <p className="text-[13px] text-muted">
        Wellbeing trends appear once you have submitted a few weekly check-ins.
      </p>
    );
  }

  return (
    <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
      {WELLBEING_FACETS.map((facet) => {
        const latest = data[data.length - 1][facet.key];
        return (
          <ChartFrame key={facet.key} title={facet.label} note={facet.hint} height={112}>
            <div className="relative size-full">
              <span className="im-mono absolute right-0 top-0 z-1 text-[15px] font-extrabold text-white">
                {latest}
              </span>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -30 }}>
                  <defs>
                    <linearGradient id={`im-wb-${facet.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={30} />
                  <YAxis {...AXIS_PROPS} width={34} domain={[0, 10]} ticks={[0, 10]} />
                  <Tooltip
                    cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
                    content={<ChartTooltip labelFormatter={(l) => `Week of ${l}`} />}
                  />
                  <Area
                    dataKey={facet.key}
                    name={facet.label}
                    type="monotone"
                    stroke={CHART.accent}
                    strokeWidth={MARKS.lineWidth}
                    fill={`url(#im-wb-${facet.key})`}
                    dot={false}
                    activeDot={{
                      r: MARKS.dotRadius,
                      fill: CHART.accent,
                      stroke: CHART.surface,
                      strokeWidth: MARKS.ringWidth,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartFrame>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   Sparkline — for dashboard cards, where the shape is the message.
   ------------------------------------------------------------------ */
export function Sparkline({
  data,
  dataKey,
  height = 44,
}: {
  data: WeekBucket[];
  dataKey: keyof WeekBucket;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Bar dataKey={dataKey as string} fill={CHART.accent} maxBarSize={6} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
