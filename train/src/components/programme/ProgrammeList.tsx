'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { Rise } from '@/components/motion/Rise';
import {
  duplicateProgrammeTemplate,
  saveProgrammeTemplate,
  setProgrammeArchived,
} from '@/app/actions/programme-templates';
import type { ProgramTemplateItem } from '@/lib/domain/library';
import { originLabel } from '@/lib/domain/library';
import { DISCIPLINE_LABELS } from '@/lib/domain/programme-template';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';

/**
 * The programmes a coach can build from or assign.
 *
 * Each card states the training frequency the programme was written for,
 * because that is the first thing a coach checks against the athlete in front
 * of them — and the thing the old seven-day assignment never let them see.
 */
export function ProgrammeList({
  templates,
  coachId,
  athletes,
  defaultStart,
}: {
  templates: ProgramTemplateItem[];
  coachId: string;
  athletes: { id: string; name: string }[];
  defaultStart: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; message: string; id?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.message);
      else {
        setCreating(false);
        if (result.id) router.push(`/coach/programs/${result.id}`);
        else router.refresh();
      }
    });

  if (creating) {
    return (
      <div className="mt-8">
        <NewProgramme pending={pending} error={error} onCancel={() => setCreating(false)} onSave={(input) => run(() => saveProgrammeTemplate(input))} />
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          New programme
        </Button>
      </div>

      {templates.length === 0 ? (
        <Panel className="mt-6 p-8 text-center">
          <p className="text-[14px] text-ink-secondary">Nothing matches those filters.</p>
        </Panel>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t, i) => {
            const item = t as unknown as {
              id: string; name: string; weeks: number; description: string;
              ownerId: string | null; visibility: 'private' | 'shared' | 'system';
              archivedAt: string | null; goalType: string;
              discipline?: string; minDaysPerWeek?: number | null; maxDaysPerWeek?: number | null;
            };
            const mine = item.ownerId === coachId && item.visibility !== 'system';
            return (
              <Rise key={item.id} delay={Math.min(i, 6) * 25}>
                <Panel className={`flex h-full flex-col p-6 ${item.archivedAt ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="im-micro">
                        {item.discipline
                          ? DISCIPLINE_LABELS[item.discipline as keyof typeof DISCIPLINE_LABELS]
                          : 'Running'}
                      </p>
                      <h3 className="im-display mt-2.5 text-[1.15rem]">{item.name}</h3>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
                        {originLabel(item, coachId)}
                        {item.archivedAt && ' · Archived'}
                      </p>
                    </div>
                    <Badge tone="neutral">{item.weeks}w</Badge>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-hairline pt-4">
                    <div>
                      <dt className="im-micro">Goal</dt>
                      <dd className="mt-1 text-[13px] font-semibold text-ink">
                        {EVENT_TYPE_LABELS[item.goalType as keyof typeof EVENT_TYPE_LABELS] ?? item.goalType}
                      </dd>
                    </div>
                    <div>
                      <dt className="im-micro">Days a week</dt>
                      <dd className="mt-1 text-[13px] font-semibold text-ink">
                        {item.minDaysPerWeek && item.maxDaysPerWeek
                          ? item.minDaysPerWeek === item.maxDaysPerWeek
                            ? item.minDaysPerWeek
                            : `${item.minDaysPerWeek}–${item.maxDaysPerWeek}`
                          : '—'}
                      </dd>
                    </div>
                  </dl>

                  {item.description && (
                    <p className="mt-4 flex-1 text-[13px] leading-relaxed text-ink-secondary">
                      {item.description}
                    </p>
                  )}

                  {!item.archivedAt && athletes.length > 0 && (
                    <AssignLink templateId={item.id} athletes={athletes} defaultStart={defaultStart} />
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/coach/programs/${item.id}`)}>
                      {mine ? 'Edit' : 'View'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => duplicateProgrammeTemplate(item.id, `${item.name} (copy)`))}
                    >
                      Duplicate
                    </Button>
                    {mine && (
                      <Button
                        variant="quiet"
                        size="sm"
                        disabled={pending}
                        onClick={() => run(() => setProgrammeArchived(item.id, !item.archivedAt))}
                      >
                        {item.archivedAt ? 'Restore' : 'Archive'}
                      </Button>
                    )}
                  </div>
                </Panel>
              </Rise>
            );
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-5 text-[13px] text-status-missed">
          {error}
        </p>
      )}
    </>
  );
}

/** Pick an athlete and a date, then read the review before anything happens. */
function AssignLink({
  templateId,
  athletes,
  defaultStart,
}: {
  templateId: string;
  athletes: { id: string; name: string }[];
  defaultStart: string;
}) {
  const [open, setOpen] = useState(false);
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '');
  const [start, setStart] = useState(defaultStart);

  if (!open) {
    return (
      <div className="mt-4">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Assign to athlete
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Athlete
          <Select className="mt-1.5 w-full" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Start (Monday)
          <Input type="date" className="mt-1.5" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/coach/programs/${templateId}/assign?athlete=${athleteId}&start=${start}`}
          className="inline-flex items-center rounded-xs border border-transparent bg-mint px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-mint-deep transition-colors hover:bg-mint-bright"
        >
          Review
        </Link>
        <Button variant="quiet" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function NewProgramme({
  pending,
  error,
  onSave,
  onCancel,
}: {
  pending: boolean;
  error: string | null;
  onSave: (input: Parameters<typeof saveProgrammeTemplate>[0]) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    discipline: 'running',
    goalType: 'general_endurance',
    minDaysPerWeek: '4',
    maxDaysPerWeek: '5',
    visibility: 'private' as 'private' | 'shared',
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Panel className="p-6">
      <h2 className="im-display text-[1.25rem]">New programme</h2>
      <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-secondary">
        Name it and say how often it trains. Blocks and weeks come next.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="im-micro">Name</span>
          <Input className="mt-1.5 w-full" value={form.name} onChange={set('name')} autoFocus maxLength={120} />
        </label>
        <label className="md:col-span-2">
          <span className="im-micro">Description</span>
          <Input className="mt-1.5 w-full" value={form.description} onChange={set('description')} maxLength={300} />
        </label>
        <label>
          <span className="im-micro">Discipline</span>
          <Select className="mt-1.5 w-full" value={form.discipline} onChange={set('discipline')}>
            {Object.entries(DISCIPLINE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </label>
        <label>
          <span className="im-micro">Goal</span>
          <Select className="mt-1.5 w-full" value={form.goalType} onChange={set('goalType')}>
            {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </label>
        <label>
          <span className="im-micro">Trains at least</span>
          <Input type="number" min="1" max="7" className="mt-1.5 w-full" value={form.minDaysPerWeek} onChange={set('minDaysPerWeek')} />
        </label>
        <label>
          <span className="im-micro">And at most</span>
          <Input type="number" min="1" max="7" className="mt-1.5 w-full" value={form.maxDaysPerWeek} onChange={set('maxDaysPerWeek')} />
        </label>
        <label>
          <span className="im-micro">Visibility</span>
          <Select className="mt-1.5 w-full" value={form.visibility} onChange={set('visibility')}>
            <option value="private">Private to me</option>
            <option value="shared">Shared with coaches</option>
          </Select>
        </label>
      </div>

      {error && <p role="alert" className="mt-5 text-[13px] text-status-missed">{error}</p>}

      <div className="mt-7 flex items-center gap-3 border-t border-hairline pt-5">
        <Button
          disabled={pending || form.name.trim().length < 2}
          onClick={() =>
            onSave({
              name: form.name,
              description: form.description,
              purpose: null,
              coachNotes: null,
              discipline: form.discipline,
              goalType: form.goalType,
              targetDistanceKm: null,
              experienceLevel: null,
              minDaysPerWeek: form.minDaysPerWeek ? Number(form.minDaysPerWeek) : null,
              maxDaysPerWeek: form.maxDaysPerWeek ? Number(form.maxDaysPerWeek) : null,
              weeks: 1,
              visibility: form.visibility,
              tags: [],
            })
          }
        >
          {pending ? 'Creating…' : 'Create and build'}
        </Button>
        <Button variant="quiet" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Panel>
  );
}
