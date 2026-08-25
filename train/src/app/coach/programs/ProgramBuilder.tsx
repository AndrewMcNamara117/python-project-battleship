'use client';

import { useState, useTransition } from 'react';
import { assignProgramTemplate, cloneWeek, type Result } from '@/app/actions/coach';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { PROGRAM_TEMPLATES } from '@/data/workout-library';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';

export function ProgramBuilder({
  athletes,
  defaultStart,
}: {
  athletes: { id: string; name: string }[];
  defaultStart: string;
}) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '');
  const [templateId, setTemplateId] = useState(PROGRAM_TEMPLATES[0].id);
  const [startDate, setStartDate] = useState(defaultStart);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const template = PROGRAM_TEMPLATES.find((t) => t.id === templateId)!;

  return (
    <Panel className="p-6 sm:p-8">
      <PanelHeader label="Assign a programme" />
      <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-muted">
        A template is a starting frame. Assigning it copies every session into that athlete&apos;s own
        calendar, so editing their week never touches anyone else&apos;s.
      </p>

      <div className="mt-7 grid gap-6 sm:grid-cols-3">
        <Field label="Athlete">
          {(p) => (
            <Select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} {...p}>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Template">
          {(p) => (
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} {...p}>
              {PROGRAM_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Start (Monday)">
          {(p) => <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} {...p} />}
        </Field>
      </div>

      <div className="mt-6 border-t border-line pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral">{EVENT_TYPE_LABELS[template.goalType]}</Badge>
          <Badge tone="neutral">{template.weeks} weeks</Badge>
        </div>
        <p className="mt-4 max-w-[70ch] text-[13px] leading-relaxed text-muted">{template.description}</p>
      </div>

      {result && (
        <p role="status" className={`mt-6 text-[13px] font-bold ${result.ok ? 'text-green' : 'text-alert'}`}>
          {result.message}
        </p>
      )}

      <Button
        size="lg"
        className="mt-7"
        disabled={pending || !athleteId}
        onClick={() => start(async () => setResult(await assignProgramTemplate(athleteId, templateId, startDate)))}
      >
        {pending ? 'Writing the block…' : 'Assign programme'}
      </Button>
    </Panel>
  );
}

export function WeekCloner({
  athletes,
  defaultStart,
}: {
  athletes: { id: string; name: string }[];
  defaultStart: string;
}) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '');
  const [source, setSource] = useState(defaultStart);
  const [target, setTarget] = useState(defaultStart);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <Panel className="p-6 sm:p-8">
      <PanelHeader label="Clone a week" />
      <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-muted">
        Copies a week&apos;s prescription onto another week. Copied sessions come across as scheduled
        again, whatever happened in the original.
      </p>

      <div className="mt-7 grid gap-6 sm:grid-cols-3">
        <Field label="Athlete">
          {(p) => (
            <Select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} {...p}>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Copy from (Monday)">
          {(p) => <Input type="date" value={source} onChange={(e) => setSource(e.target.value)} {...p} />}
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
        disabled={pending || !athleteId}
        onClick={() => start(async () => setResult(await cloneWeek(athleteId, source, target)))}
      >
        {pending ? 'Copying…' : 'Clone week'}
      </Button>
    </Panel>
  );
}
