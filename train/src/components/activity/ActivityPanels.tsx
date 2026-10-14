import Link from 'next/link';
import { ForgeLine } from '@/components/forge/ForgeLine';
import { SectionHeading } from '@/components/forge/AppHeader';
import { Panel } from '@/components/ui/Panel';
import type { Split, ZoneBand } from '@/lib/activity/analyse';
import { zonesFromHistogram } from '@/lib/activity/analyse';
import type { Activity } from '@/lib/activity/types';
import { formatDuration, formatPace, formatPaceRange } from '@/lib/domain/dates';
import type { ScheduledWorkout, Units } from '@/lib/domain/types';

/**
 * The panels of an activity page. Server components throughout: the numbers
 * are computed at import, so rendering is arithmetic and markup.
 */

export function distanceLabel(m: number, units: Units): string {
  const v = units === 'imperial' ? m / 1609.344 : m / 1000;
  return `${v.toFixed(v >= 100 ? 0 : 2)} ${units === 'imperial' ? 'mi' : 'km'}`;
}

/* ---------------- headline figures ---------------- */

export function StatStrip({ activity, units }: { activity: Activity; units: Units }) {
  const stats: { label: string; value: string; note?: string }[] = [
    { label: 'Distance', value: distanceLabel(activity.distanceM, units) },
    {
      label: 'Moving time',
      value: formatDuration(activity.movingS),
      note: activity.elapsedS - activity.movingS > 60 ? `${formatDuration(activity.elapsedS)} elapsed` : undefined,
    },
    { label: 'Pace', value: formatPace(activity.avgPaceSecPerKm, units) },
    {
      label: 'Heart rate',
      value: activity.avgHr ? `${activity.avgHr} bpm` : '—',
      note: activity.maxHr ? `max ${activity.maxHr}` : undefined,
    },
    {
      label: 'Climb',
      value: activity.ascentM != null ? `${units === 'imperial' ? Math.round(activity.ascentM * 3.28084) + ' ft' : activity.ascentM + ' m'}` : '—',
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xs border border-hairline bg-hairline sm:grid-cols-5">
      {stats.map((s, i) => (
        // five in a two-column grid: the last takes the whole row rather than leave a hole
        <div key={s.label} className={`bg-charcoal px-4 py-4 sm:px-5 ${i === stats.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}>
          <dt className="im-micro">{s.label}</dt>
          <dd className="im-figure mt-2 text-[clamp(1.25rem,2.6vw,1.6rem)]">{s.value}</dd>
          {s.note && <dd className="mt-1 text-[11px] text-ink-tertiary">{s.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

/* ---------------- plan vs actual ---------------- */

function zoneShare(zones: ZoneBand[] | null, zone: number | null): number | null {
  if (!zones || zone == null) return null;
  const total = zones.reduce((n, z) => n + z.seconds, 0);
  if (!total) return null;
  return (zones.find((z) => z.zone === zone)?.seconds ?? 0) / total;
}

/**
 * What the coach wrote beside what the watch measured. Each row states the
 * difference plainly and never grades it — whether 9 km against a prescribed
 * 8 is good depends on the athlete, and that judgement is the coach's.
 */
export function PlanVsActual({
  activity,
  session,
  units,
  maxHr,
  sessionHref,
}: {
  activity: Activity;
  session: ScheduledWorkout;
  units: Units;
  maxHr: number | null;
  sessionHref?: string;
}) {
  const zones = maxHr && activity.hrHistogram.length ? zonesFromHistogram(activity.hrHistogram, maxHr) : null;
  const share = zoneShare(zones, session.hrZone);
  const actualKm = activity.distanceM / 1000;
  const pace = activity.avgPaceSecPerKm;

  const rows: { label: string; plan: string; actual: string; delta?: string }[] = [];
  if (session.distanceKm != null) {
    const diff = actualKm - session.distanceKm;
    rows.push({
      label: 'Distance',
      plan: distanceLabel(session.distanceKm * 1000, units),
      actual: distanceLabel(activity.distanceM, units),
      delta: Math.abs(diff) < 0.05 ? 'as written' : `${diff > 0 ? '+' : '−'}${distanceLabel(Math.abs(diff) * 1000, units)}`,
    });
  }
  if (session.durationMinutes != null) {
    const diff = Math.round(activity.movingS / 60) - session.durationMinutes;
    rows.push({
      label: 'Time',
      plan: `${session.durationMinutes} min`,
      actual: formatDuration(activity.movingS),
      delta: Math.abs(diff) < 1 ? 'as written' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} min`,
    });
  }
  if (session.paceRange && pace != null) {
    const inside = pace >= session.paceRange.minSecPerKm && pace <= session.paceRange.maxSecPerKm;
    rows.push({
      label: 'Pace',
      plan: formatPaceRange(session.paceRange, units),
      actual: formatPace(pace, units),
      delta: inside ? 'inside the range' : pace < session.paceRange.minSecPerKm ? 'quicker than the range' : 'easier than the range',
    });
  }
  if (session.hrZone != null) {
    rows.push({
      label: 'Heart rate',
      plan: `Zone ${session.hrZone}`,
      actual: share != null ? `${Math.round(share * 100)}% in Z${session.hrZone}` : activity.avgHr ? `${activity.avgHr} bpm avg` : '—',
      delta: share == null && activity.avgHr ? (maxHr ? undefined : 'set max HR to compare zones') : undefined,
    });
  }

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading
        label="Planned against done"
        action={
          sessionHref ? (
            <Link href={sessionHref} className="im-micro text-mint hover:underline">
              {session.name}
            </Link>
          ) : (
            <span className="im-micro text-ink-secondary">{session.name}</span>
          )
        }
      />
      {rows.length ? (
        <table className="mt-4 w-full text-left text-[13px]">
          <thead>
            <tr className="im-micro text-ink-tertiary">
              <th scope="col" className="py-2 pr-3 font-bold">
                <span className="sr-only">Measure</span>
              </th>
              <th scope="col" className="py-2 pr-3 font-bold">Plan</th>
              <th scope="col" className="py-2 pr-3 font-bold">Done</th>
              <th scope="col" className="hidden py-2 font-bold sm:table-cell">
                <span className="sr-only">Difference</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-hairline align-baseline">
                <th scope="row" className="py-3 pr-3 font-bold text-ink-secondary">{r.label}</th>
                <td className="py-3 pr-3 tabular-nums text-ink-body">{r.plan}</td>
                <td className="py-3 pr-3 tabular-nums font-bold text-ink">
                  {r.actual}
                  {r.delta && <span className="mt-0.5 block text-[11px] font-normal text-ink-tertiary sm:hidden">{r.delta}</span>}
                </td>
                <td className="hidden py-3 text-[12px] text-ink-tertiary sm:table-cell">{r.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-[13px] text-ink-secondary">The session was prescribed by feel, so there is nothing to measure against.</p>
      )}
    </Panel>
  );
}

/* ---------------- splits ---------------- */

export function SplitsTable({ splits, units }: { splits: Split[]; units: Units }) {
  if (!splits.length) return null;
  const paces = splits.map((s) => s.paceSecPerKm).filter((p): p is number => p != null);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const unit = units === 'imperial' ? 'Mile' : 'Km';

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading label="Splits" />
      <table className="mt-4 w-full text-left text-[13px]">
        <thead>
          <tr className="im-micro text-ink-tertiary">
            <th scope="col" className="py-2 pr-3 font-bold">{unit}</th>
            <th scope="col" className="py-2 pr-3 font-bold">Pace</th>
            <th scope="col" className="w-full py-2 pr-3 font-bold">
              <span className="sr-only">Relative pace</span>
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-bold">HR</th>
            <th scope="col" className="py-2 text-right font-bold">Elev</th>
          </tr>
        </thead>
        <tbody>
          {splits.map((s) => {
            // longer bar = quicker split; the slowest still shows, so nothing reads as zero
            // perfectly even pacing has no spread to show: every bar is full
            const span = slowest - fastest;
            const share = s.paceSecPerKm == null ? 0 : span === 0 ? 1 : 0.35 + 0.65 * ((slowest - s.paceSecPerKm) / span);
            const partial = s.distanceM < (units === 'imperial' ? 1600 : 990);
            return (
              <tr key={s.index} className="border-t border-hairline">
                <td className="py-2.5 pr-3 tabular-nums text-ink-secondary">
                  {partial ? `${(s.distanceM / (units === 'imperial' ? 1609.344 : 1000)).toFixed(2)}` : s.index}
                </td>
                <td className="py-2.5 pr-3 tabular-nums font-bold text-ink whitespace-nowrap">
                  {formatPace(s.paceSecPerKm, units).replace(/ \/.+$/, '')}
                </td>
                <td className="py-2.5 pr-3" aria-hidden>
                  <div className="h-1.5 w-full bg-steel/60">
                    <div
                      className={`h-1.5 origin-left ${s.paceSecPerKm === fastest ? 'bg-mint' : 'bg-mint-dim'}`}
                      style={{ transform: `scaleX(${share.toFixed(3)})` }}
                    />
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-ink-body">{s.avgHr ?? '—'}</td>
                <td className="py-2.5 text-right tabular-nums text-ink-secondary whitespace-nowrap">
                  {s.elevationDeltaM == null ? '—' : `${s.elevationDeltaM > 0 ? '+' : ''}${units === 'imperial' ? Math.round(s.elevationDeltaM * 3.28084) : s.elevationDeltaM}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

/* ---------------- zones ---------------- */

export function ZonePanel({
  activity,
  maxHr,
  prescribedZone,
  settingsHref,
}: {
  activity: Activity;
  maxHr: number | null;
  prescribedZone: number | null;
  /** Where the athlete sets max HR; omitted on the coach's view. */
  settingsHref?: string;
}) {
  if (!activity.hrHistogram.length) return null;
  if (!maxHr) {
    return (
      <Panel className="p-5 sm:p-6">
        <SectionHeading label="Heart-rate zones" />
        <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
          Zones are cut against a measured maximum, never one estimated from age — age formulas are commonly ten or more
          beats out, which is a whole zone.{' '}
          {settingsHref ? (
            <Link href={settingsHref} className="font-bold text-mint hover:underline">
              Add your max heart rate
            </Link>
          ) : (
            'The athlete has not set a max heart rate yet.'
          )}
        </p>
      </Panel>
    );
  }

  const zones = zonesFromHistogram(activity.hrHistogram, maxHr);
  const total = zones.reduce((n, z) => n + z.seconds, 0) || 1;
  const top = Math.max(...zones.map((z) => z.seconds)) || 1;

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading label="Heart-rate zones" action={<span className="im-micro text-ink-tertiary">Max {maxHr} bpm</span>} />
      <ul className="mt-4 space-y-2.5">
        {[...zones].reverse().map((z) => {
          const prescribed = z.zone === prescribedZone;
          return (
            <li key={z.zone} className="grid grid-cols-[3.25rem_1fr_4.5rem] items-center gap-3 text-[12px]">
              <span className={`font-bold ${prescribed ? 'text-mint' : 'text-ink-secondary'}`}>
                Z{z.zone}
                {prescribed && <span className="sr-only"> (prescribed)</span>}
              </span>
              <span className="relative h-3 bg-steel/50" aria-hidden>
                <span
                  className={`absolute inset-y-0 left-0 w-full origin-left ${prescribed ? 'bg-mint' : 'bg-ink-faint'}`}
                  style={{ transform: `scaleX(${(z.seconds / top).toFixed(3)})` }}
                />
              </span>
              <span className="text-right tabular-nums text-ink-body">
                {formatDuration(z.seconds)}
                <span className="ml-1.5 text-ink-tertiary">{Math.round((z.seconds / total) * 100)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[11px] text-ink-tertiary">
        {zones.map((z) => `Z${z.zone} ${z.fromBpm}${z.toBpm ? `–${z.toBpm - 1}` : '+'}`).join(' · ')}
      </p>
    </Panel>
  );
}

/* ---------------- profile charts ---------------- */

export function ProfileCharts({ activity, units }: { activity: Activity; units: Units }) {
  const eles = activity.series.map((p) => p.ele).filter((e): e is number => e != null);
  const hrs = activity.series.map((p) => p.hr).filter((h): h is number => h != null);
  if (eles.length < 3 && hrs.length < 3) return null;
  const toUnit = (m: number) => (units === 'imperial' ? m * 3.28084 : m);

  return (
    <Panel className="p-5 sm:p-6">
      <SectionHeading label="Profile" />
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {eles.length >= 3 && (
          <div>
            <p className="im-micro">Elevation</p>
            <p className="mt-1 text-[12px] text-ink-tertiary tabular-nums">
              {Math.round(toUnit(Math.min(...eles)))}–{Math.round(toUnit(Math.max(...eles)))} {units === 'imperial' ? 'ft' : 'm'}
            </p>
            <ForgeLine variant="elevation" data={eles.map(toUnit)} label="Elevation across the activity" unit={units === 'imperial' ? 'ft' : 'm'} className="mt-3 h-24 w-full" />
          </div>
        )}
        {hrs.length >= 3 && (
          <div>
            <p className="im-micro">Heart rate</p>
            <p className="mt-1 text-[12px] text-ink-tertiary tabular-nums">
              {Math.min(...hrs)}–{Math.max(...hrs)} bpm
            </p>
            <ForgeLine variant="performance" data={hrs} label="Heart rate across the activity" unit="bpm" showNode={false} className="mt-3 h-24 w-full" />
          </div>
        )}
      </div>
    </Panel>
  );
}
