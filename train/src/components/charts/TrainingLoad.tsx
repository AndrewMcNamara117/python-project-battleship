import { SectionHeading } from '@/components/forge/AppHeader';
import { ForgeLine } from '@/components/forge/ForgeLine';
import { Panel } from '@/components/ui/Panel';
import { addDays, formatDayMonth, startOfWeek } from '@/lib/domain/dates';
import { TREND_LABELS, type LoadSummary } from '@/lib/domain/load';

/**
 * Fitness, fatigue and form, for a coach — or, more gently worded, for the
 * athlete. The line in Mint is fitness; the recessive steel line is fatigue;
 * the bars beneath are weekly load. Context, never an instruction.
 */
export function TrainingLoad({ load, audience }: { load: LoadSummary; audience: 'coach' | 'athlete' }) {
  const { scored } = load;
  const total = scored.rpe + scored.heartRate + scored.unscored;

  if (scored.rpe + scored.heartRate === 0) {
    return (
      <Panel className="p-5 sm:p-6">
        <SectionHeading label="Training load" />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
          {audience === 'coach'
            ? 'Nothing scored yet. Load comes from RPE on each logged session, or from heart rate on imported runs once a max heart rate is set.'
            : 'Add an RPE when you log a session — how hard it felt, out of ten — and your training load builds from there.'}
        </p>
      </Panel>
    );
  }

  // weekly totals for the bars: twelve weeks ending this week
  const lastDay = load.days[load.days.length - 1]?.date;
  const weeks: { start: string; load: number }[] = [];
  if (lastDay) {
    const thisWeek = startOfWeek(lastDay);
    for (let w = 11; w >= 0; w--) {
      const start = addDays(thisWeek, -7 * w);
      const end = addDays(start, 6);
      weeks.push({ start, load: load.days.filter((d) => d.date >= start && d.date <= end).reduce((a, d) => a + d.load, 0) });
    }
  }

  const figures = [
    { label: 'Fitness', value: Math.round(load.fitness), note: '42-day average' },
    { label: 'Fatigue', value: Math.round(load.fatigue), note: '7-day average' },
    { label: 'Form', value: `${load.form > 0 ? '+' : ''}${Math.round(load.form)}`, note: load.form < 0 ? 'carrying fatigue' : 'fresh' },
    {
      label: 'Ratio',
      value: load.ratio != null ? load.ratio.toFixed(2) : '—',
      note: load.trend ? TREND_LABELS[load.trend] : 'needs four weeks',
    },
  ];

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading
        label="Training load"
        action={
          load.trend && (
            <span className={`im-micro ${load.trend === 'building_fast' ? 'text-status-progress' : 'text-ink-tertiary'}`}>
              {TREND_LABELS[load.trend]}
            </span>
          )
        }
      />
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label}>
            <dt className="im-micro">{f.label}</dt>
            <dd className="im-figure mt-1.5 text-[1.5rem]">{f.value}</dd>
            <dd className="text-[11px] text-ink-tertiary">{f.note}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5">
        <ForgeLine
          variant="performance"
          data={load.days.map((d) => d.fitness)}
          reference={load.days.map((d) => d.fatigue)}
          label="Fitness over the last twelve weeks, with fatigue as a reference line"
          showNode
          className="h-28 w-full"
        />
        <ForgeLine variant="load" data={weeks.map((w) => w.load)} label="Weekly training load, last twelve weeks" className="mt-2 h-12 w-full" />
        <div className="mt-1.5 flex justify-between text-[10px] text-ink-tertiary">
          <span>{weeks[0] ? formatDayMonth(weeks[0].start) : ''}</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5"><span className="inline-block h-px w-4 bg-mint" aria-hidden /> Fitness</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-px w-4 border-t border-dashed border-steel" aria-hidden /> Fatigue</span>
          </span>
          <span>This week</span>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-tertiary">
        Load is effort × minutes. {scored.rpe} of {total} sessions scored from RPE
        {scored.heartRate ? `, ${scored.heartRate} estimated from heart rate` : ''}
        {scored.unscored ? `, ${scored.unscored} not scored (no RPE${audience === 'athlete' ? ' — add one to count them' : ''})` : ''}.
        {audience === 'coach' && ' The ratio bands describe a trend; they are not a diagnosis.'}
      </p>
    </Panel>
  );
}
