'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { saveProgrammeAsTemplate } from '@/app/actions/programme-templates';
import type { ExtractionPreview } from '@/lib/domain/programme-template';
import { DISCIPLINE_LABELS } from '@/lib/domain/programme-template';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';

/**
 * Save the programme you have already adapted, so the next athlete starts
 * from the version that worked.
 *
 * The coach reads the shape and what will not travel before anything is
 * written. The template is theirs; nothing about this athlete goes with it.
 */
export function SaveAsTemplate({
  preview,
  athleteId,
}: {
  preview: ExtractionPreview;
  athleteId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; id?: string } | null>(null);
  const [form, setForm] = useState({
    name: preview.suggested.name,
    visibility: preview.suggested.visibility,
    discipline: preview.suggested.discipline,
    goalType: preview.suggested.goalType ?? 'general_endurance',
    experienceLevel: preview.suggested.experienceLevel ?? '',
    purpose: '',
    coachNotes: '',
  });

  const blockers = preview.notes.filter((n) => n.severity === 'block');
  const warnings = preview.notes.filter((n) => n.severity === 'warn');
  const facts = preview.notes.filter((n) => n.severity === 'info');

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = () =>
    startTransition(async () => {
      const outcome = await saveProgrammeAsTemplate(preview.programId, athleteId, {
        ...preview.suggested,
        name: form.name,
        visibility: form.visibility,
        discipline: form.discipline,
        goalType: form.goalType,
        experienceLevel: form.experienceLevel || null,
        purpose: form.purpose.trim() || null,
        coachNotes: form.coachNotes.trim() || null,
      });
      setResult(outcome);
      if (outcome.ok) {
        setOpen(false);
        router.refresh();
      }
    });

  if (!open) {
    return (
      <div className="mt-5 border-t border-hairline pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={blockers.length > 0}
            onClick={() => { setResult(null); setOpen(true); }}
          >
            Save as template
          </Button>
          {blockers.length > 0 && (
            <p className="text-[12px] text-ink-tertiary">{blockers[0].detail}</p>
          )}
          {blockers.length === 0 && (
            <p className="text-[12px] text-ink-tertiary">
              Reuse this programme&rsquo;s shape for another athlete.
            </p>
          )}
        </div>

        {result && (
          <p
            role="status"
            className={`mt-3 text-[13px] leading-relaxed ${result.ok ? 'text-mint' : 'text-status-missed'}`}
          >
            {result.message}
            {result.ok && result.id && (
              <>
                {' '}
                <Link href={`/coach/programs/${result.id}`} className="underline">
                  Open it
                </Link>
                .
              </>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-hairline pt-5">
      <Panel className="p-5 sm:p-6">
        <h3 className="im-display text-[1.15rem]">Save as template</h3>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-secondary">
          A snapshot of what you prescribed. Editing {preview.athleteName}&rsquo;s programme afterwards
          will not change it, and editing it will not change them.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-hairline pt-4 sm:grid-cols-4">
          <Stat label="Blocks" value={String(preview.blocks)} />
          <Stat label="Weeks" value={String(preview.weeks)} />
          <Stat label="Sessions" value={String(preview.sessions)} />
          <Stat
            label="Trains"
            value={
              preview.minDaysPerWeek && preview.maxDaysPerWeek
                ? preview.minDaysPerWeek === preview.maxDaysPerWeek
                  ? `${preview.minDaysPerWeek} days`
                  : `${preview.minDaysPerWeek}–${preview.maxDaysPerWeek} days`
                : '—'
            }
          />
        </dl>

        {warnings.length > 0 && (
          <div className="mt-5 border-t border-hairline pt-4">
            <p className="im-micro text-status-missed">Worth knowing before you save</p>
            <ul className="mt-3 space-y-2.5">
              {warnings.map((n, i) => (
                <li key={i} className="border-l border-hairline-strong pl-3 text-[13px] leading-relaxed text-ink-body">
                  {n.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {facts.length > 0 && (
          <ul className="mt-4 space-y-2">
            {facts.map((n, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-ink-tertiary">
                {n.detail}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 grid gap-5 border-t border-hairline pt-5 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="im-micro">Name</span>
            <Input className="mt-1.5 w-full" value={form.name} onChange={set('name')} maxLength={120} autoFocus />
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
            <span className="im-micro">Written for</span>
            <Select className="mt-1.5 w-full" value={form.experienceLevel} onChange={set('experienceLevel')}>
              <option value="">Any experience</option>
              <option value="beginner">Beginner</option>
              <option value="developing">Developing</option>
              <option value="experienced">Experienced</option>
              <option value="competitive">Competitive</option>
            </Select>
          </label>

          <label>
            <span className="im-micro">Visibility</span>
            <Select
              className="mt-1.5 w-full"
              value={form.visibility}
              onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as 'private' | 'shared' }))}
            >
              <option value="private">Private to me</option>
              <option value="shared">Shared with coaches</option>
            </Select>
          </label>

          <label className="md:col-span-2">
            <span className="im-micro">What it is for</span>
            <Input
              className="mt-1.5 w-full"
              value={form.purpose}
              onChange={set('purpose')}
              maxLength={300}
              placeholder="Twelve weeks of aerobic base for someone returning to structure"
            />
          </label>

          <label className="md:col-span-2">
            <span className="im-micro">Coach notes</span>
            <Input
              className="mt-1.5 w-full"
              value={form.coachNotes}
              onChange={set('coachNotes')}
              maxLength={500}
              placeholder="Private to you"
            />
          </label>
        </div>

        {result && !result.ok && (
          <p role="alert" className="mt-5 text-[13px] leading-relaxed text-status-missed">
            {result.message}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
          <Button disabled={pending || form.name.trim().length < 2} onClick={save}>
            {pending ? 'Saving…' : 'Save to my programmes'}
          </Button>
          <Button variant="quiet" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd className="mt-1.5 text-[15px] font-bold text-ink">{value}</dd>
    </div>
  );
}
