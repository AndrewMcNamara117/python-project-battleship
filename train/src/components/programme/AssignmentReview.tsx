'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { assignProgramme } from '@/app/actions/programme-templates';
import type { AssignmentPreview } from '@/lib/domain/programme-template';
import { formatDayMonth } from '@/lib/domain/dates';
import { EVENT_TYPE_LABELS, WEEKDAY_SHORT } from '@/lib/domain/types';
import type { Weekday } from '@/lib/domain/types';

const ALL_DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * What the coach sees before committing.
 *
 * Warnings are explicit and never resolved on the coach's behalf. The only
 * things that stop an assignment are the ones that would produce something
 * invalid or unauthorised — a programme with no weeks, an athlete off the
 * roster, a start date that is not a Monday. Everything else is a judgement
 * the coach is better placed to make than the software is.
 */
export function AssignmentReview({ preview }: { preview: AssignmentPreview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const blockers = preview.conflicts.filter((c) => c.severity === 'block');
  const warnings = preview.conflicts.filter((c) => c.severity === 'warn');

  // Replacing prescribed training is not the same as assigning into an empty
  // calendar, so it is not the same click. The coach ticks a box that names
  // what goes and what stays.
  const replacing = preview.conflicts.find((c) => c.kind === 'replacing');
  const keeping = preview.conflicts.find((c) => c.kind === 'history_kept');
  const needsConfirmation = Boolean(replacing);
  const ready = blockers.length === 0 && (!needsConfirmation || confirmed);
  const coachingWarnings = warnings.filter((c) => c.kind !== 'replacing' && c.kind !== 'history_kept');

  const assign = () =>
    startTransition(async () => {
      const outcome = await assignProgramme(preview.template.id, preview.athleteId, preview.startDate);
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });

  return (
    <div className="mt-8 space-y-5">
      {blockers.length > 0 && (
        <Panel className="border-status-missed/40 p-5">
          <p className="im-micro text-status-missed">Cannot assign</p>
          <ul className="mt-3 space-y-2">
            {blockers.map((c, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-ink">
                {c.detail}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {coachingWarnings.length > 0 && (
        <Panel className="border-hairline-strong p-5">
          <p className="im-micro text-status-missed">
            {coachingWarnings.length} thing{coachingWarnings.length === 1 ? '' : 's'} to weigh
          </p>
          <p className="mt-2 max-w-[62ch] text-[12px] leading-relaxed text-ink-tertiary">
            None of these stop the assignment, and none of them have been acted on. Nothing has been moved or
            dropped to make the programme fit.
          </p>
          <ul className="mt-4 space-y-2.5">
            {warnings.filter((c) => c.kind !== 'replacing' && c.kind !== 'history_kept').map((c, i) => (
              <li key={i} className="border-l border-hairline-strong pl-3 text-[13px] leading-relaxed text-ink-body">
                {c.detail}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-5 sm:p-6">
          <p className="im-micro">The programme</p>
          <h3 className="im-display mt-2.5 text-[1.2rem]">{preview.template.name}</h3>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-hairline pt-4">
            <Row label="Duration" value={`${preview.template.weeks} weeks`} />
            <Row label="Starts" value={formatDayMonth(preview.startDate)} />
            <Row label="Ends" value={formatDayMonth(preview.endDate)} />
            <Row
              label="Written for"
              value={frequencyLabel(preview.template.minDaysPerWeek, preview.template.maxDaysPerWeek)}
            />
          </dl>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <p className="im-micro">{preview.athleteName}</p>

          {preview.goal ? (
            <>
              <h3 className="im-display mt-2.5 text-[1.2rem]">
                {preview.goal.raceName ??
                  (preview.goal.eventType
                    ? EVENT_TYPE_LABELS[preview.goal.eventType as keyof typeof EVENT_TYPE_LABELS]
                    : 'Their goal')}
              </h3>
              {(preview.goal.raceDate ?? preview.goal.targetDate) && (
                <p className="mt-1.5 text-[13px] text-ink-secondary">
                  {formatDayMonth((preview.goal.raceDate ?? preview.goal.targetDate)!)}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-tertiary">
              No goal race set for this athlete.
            </p>
          )}

          <div className="mt-5 space-y-4 border-t border-hairline pt-4">
            <DayRow label="Available" days={preview.availableDays} />
            <DayRow label="Preferred" days={preview.preferredDays} />
            <DayRow label="Programme trains" days={preview.templateDays} accent />
          </div>

          {preview.activeProgramme && (
            <p className="mt-5 border-t border-hairline pt-4 text-[12px] leading-relaxed text-ink-secondary">
              Currently on <span className="text-ink">{preview.activeProgramme.name}</span>, which this will
              archive.
            </p>
          )}
        </Panel>
      </div>

      <Panel className="p-5 sm:p-6">
        <p className="im-micro">Week by week</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-hairline-strong text-left">
                <Th>Week</Th>
                <Th>Block</Th>
                <Th className="text-right">Days</Th>
                <Th className="text-right">Sessions</Th>
                <Th className="text-right">Prescribed</Th>
                <Th className="text-right">Target</Th>
                <Th className="text-right">Diff</Th>
                <Th>Longest run</Th>
              </tr>
            </thead>
            <tbody>
              {preview.weeks.map((w) => {
                const diff = w.targetKm == null ? 0 : w.prescribedKm - w.targetKm;
                const off = w.targetKm != null && Math.abs(diff) > Math.max(w.targetKm * 0.15, 5);
                const key = preview.keySessions.find((k) => k.templateWeekNo === w.templateWeekNo);
                return (
                  <tr key={w.templateWeekNo} className="border-b border-hairline last:border-b-0">
                    <Td>
                      <span className="im-mono">{w.templateWeekNo}</span>
                      {w.isRecoveryWeek && (
                        <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-ink-tertiary">
                          Step-back
                        </span>
                      )}
                    </Td>
                    <Td className="text-ink-secondary">{w.blockName}</Td>
                    <Td className="text-right im-mono">{w.trainingDays}</Td>
                    <Td className="text-right im-mono">{w.sessionCount}</Td>
                    <Td className="text-right im-mono">{w.prescribedKm} km</Td>
                    <Td className="text-right im-mono text-ink-tertiary">
                      {w.targetKm != null ? `${w.targetKm} km` : '—'}
                    </Td>
                    <Td className={`text-right im-mono ${off ? 'text-status-missed' : 'text-ink-tertiary'}`}>
                      {w.targetKm == null
                        ? '—'
                        : `${diff > 0 ? '+' : ''}${Math.round(diff * 10) / 10}`}
                    </Td>
                    <Td className="text-ink-secondary">
                      {key
                        ? `${WEEKDAY_SHORT[key.weekday]} · ${key.name}${key.distanceKm ? ` · ${key.distanceKm} km` : ''}`
                        : '—'}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {needsConfirmation && blockers.length === 0 && (
        <Panel className="border-status-missed/40 p-5">
          <p className="im-micro text-status-missed">This replaces prescribed training</p>
          <ul className="mt-3 space-y-2">
            <li className="text-[13px] leading-relaxed text-ink">{replacing!.detail}</li>
            {keeping && <li className="text-[13px] leading-relaxed text-ink">{keeping.detail}</li>}
            {!keeping && (
              <li className="text-[13px] leading-relaxed text-ink-secondary">
                Nothing on those dates has been completed, so nothing is being kept.
              </li>
            )}
          </ul>
          <div className="mt-5 border-t border-hairline pt-4">
            <Checkbox
              label={`Replace ${preview.athleteName}'s scheduled sessions from ${formatDayMonth(preview.startDate)}`}
              description="Completed training is never removed. Replaced prescriptions stay in the session's history."
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={pending || !ready} onClick={assign}>
          {pending ? 'Assigning…' : needsConfirmation ? 'Replace and assign' : 'Assign programme'}
        </Button>
        {blockers.length > 0 && (
          <p className="text-[12px] text-ink-tertiary">Fix what is listed above first.</p>
        )}
        {blockers.length === 0 && needsConfirmation && !confirmed && (
          <p className="text-[12px] text-ink-tertiary">Confirm the replacement above to continue.</p>
        )}
      </div>

      {result && (
        <p
          role="status"
          className={`text-[13px] leading-relaxed ${result.ok ? 'text-mint' : 'text-status-missed'}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

/** "4 days a week" reads better than "4–4 days a week". */
function frequencyLabel(min: number | null, max: number | null): string {
  if (!min || !max) return 'Any frequency';
  return min === max ? `${min} days a week` : `${min}–${max} days a week`;
}

function DayRow({ label, days, accent = false }: { label: string; days: Weekday[]; accent?: boolean }) {
  return (
    <div>
      <p className="im-micro">{label}</p>
      <div className="mt-2 flex gap-1.5">
        {ALL_DAYS.map((d) => {
          const on = days.includes(d);
          return (
            <span
              key={d}
              className={`flex h-7 w-9 items-center justify-center rounded-[2px] border text-[10px] font-bold uppercase tracking-[0.08em] ${
                on
                  ? accent
                    ? 'border-mint/50 bg-mint/10 text-mint'
                    : 'border-hairline-strong text-ink'
                  : 'border-hairline text-ink-tertiary/50'
              }`}
            >
              {WEEKDAY_SHORT[d]}
            </span>
          );
        })}
      </div>
      {days.length === 0 && (
        <p className="mt-1.5 text-[11px] text-ink-tertiary">Not set</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd className="mt-1 text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

const Th = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <th className={`pb-2.5 pr-4 im-micro font-bold ${className}`}>{children}</th>
);
const Td = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <td className={`py-2.5 pr-4 ${className}`}>{children}</td>
);
