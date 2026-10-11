'use client';

/**
 * Duplicating a week inside a live athlete programme.
 *
 * Distinct from the programme templates on this page: this copies a week the
 * athlete already has onto another date in their own calendar, which is what a
 * coach reaches for mid-block rather than when starting someone new.
 */

import { useState, useTransition } from 'react';
import { duplicateWeek, type Result } from '@/app/actions/coach';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Panel, PanelHeader } from '@/components/ui/Panel';

export function WeekCloner({
  athletes,
  weeksByAthlete,
  defaultStart,
}: {
  athletes: { id: string; name: string }[];
  /** Real weeks, so a coach picks a week rather than guessing a date. */
  weeksByAthlete: Record<string, { id: string; label: string }[]>;
  defaultStart: string;
}) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '');
  const weeks = weeksByAthlete[athleteId] ?? [];
  const [source, setSource] = useState(weeks[0]?.id ?? '');
  const [target, setTarget] = useState(defaultStart);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <Panel className="p-6 sm:p-8">
      <PanelHeader label="Clone a week" />
      <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-muted">
        Copies a week&apos;s prescription — every session and every component — onto another week, in
        one call. Copied sessions come across as scheduled again, whatever happened in the original.
      </p>

      <div className="mt-7 grid gap-6 sm:grid-cols-3">
        <Field label="Athlete">
          {(p) => (
            <Select
              value={athleteId}
              onChange={(e) => {
                setAthleteId(e.target.value);
                setSource((weeksByAthlete[e.target.value] ?? [])[0]?.id ?? '');
              }}
              {...p}
            >
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Copy from">
          {(p) => (
            <Select value={source} onChange={(e) => setSource(e.target.value)} {...p}>
              {weeks.length === 0 && <option value="">No weeks yet</option>}
              {weeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Copy to (Monday)">
          {(p) => <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} {...p} />}
        </Field>
      </div>

      {result && (
        <p role="status" className={`mt-6 text-[13px] font-bold ${result.ok ? 'text-green' : 'text-alert'}`}>
          {result.message}
        </p>
      )}

      <Button
        className="mt-7"
        variant="ghost"
        disabled={pending || !athleteId || !source}
        onClick={() => start(async () => setResult(await duplicateWeek(athleteId, source, target)))}
      >
        {pending ? 'Copying…' : 'Clone week'}
      </Button>
    </Panel>
  );
}
