'use client';

import { useState, useTransition } from 'react';
import { decideApplication, type Result } from '@/app/actions/coach';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { formatDayMonth } from '@/lib/domain/dates';
import type { CoachingApplication } from '@/lib/domain/types';

export function ApplicationCard({ application }: { application: CoachingApplication }) {
  const [note, setNote] = useState(application.decidedNote ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const decided = application.status === 'accepted' || application.status === 'declined';

  function decide(decision: 'accepted' | 'declined' | 'reviewing') {
    setBusy(decision);
    start(async () => {
      setResult(await decideApplication(application.id, decision, note.trim() || null));
      setBusy(null);
    });
  }

  return (
    <Panel edge={application.status === 'new'} className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="im-display text-[1.3rem]">{application.fullName}</h2>
          <p className="im-mono mt-2 text-[12px] text-muted">
            {application.email}
            {application.phone ? ` · ${application.phone}` : ''} ·{' '}
            {formatDayMonth(application.createdAt.slice(0, 10))}
          </p>
        </div>
        <Badge
          tone={
            application.status === 'accepted'
              ? 'green'
              : application.status === 'declined'
                ? 'neutral'
                : application.status === 'reviewing'
                  ? 'warn'
                  : 'green'
          }
        >
          {application.status}
        </Badge>
      </div>

      <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-3">
        <Row label="Target race" value={application.targetRace ?? '—'} />
        <Row label="Race date" value={application.targetDate ?? '—'} />
        <Row
          label="Weekly volume"
          value={application.currentWeeklyKm != null ? `${application.currentWeeklyKm} km` : '—'}
        />
      </dl>

      <div className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
        <Block label="Goal, in their words" value={application.goal} />
        <Block label="Background" value={application.experience} />
        <Block label="Injuries or limitations" value={application.injuries || 'Nothing reported'} />
        <Block label="Wants to start" value={application.startWhen} />
      </div>

      {application.injuries && (
        <p className="mt-5 border border-warn/35 bg-warn/8 px-5 py-3.5 text-[12px] leading-relaxed text-white">
          They reported injuries or limitations. Ask for medical clearance before writing the first
          block if anything here is current.
        </p>
      )}

      {application.status === 'accepted' && (
        <p className="mt-5 border-l-2 border-green bg-green/5 px-5 py-3.5 text-[13px] leading-relaxed">
          {application.joinedAthleteId
            ? 'Accepted and on your roster.'
            : `Accepted. They join your roster automatically when they register with ${application.email}.`}
        </p>
      )}

      {!decided && (
        <div className="mt-7 border-t border-line pt-6">
          <Field label="Note" hint="Kept with the application. Not sent to the applicant.">
            {(p) => (
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why this is or is not a fit, and what you would start them on."
                {...p}
              />
            )}
          </Field>

          {result && (
            <p
              role="status"
              className={`mt-4 text-[13px] font-bold leading-relaxed ${
                result.ok ? 'text-green' : 'text-alert'
              }`}
            >
              {result.message}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button disabled={pending} onClick={() => decide('accepted')}>
              {busy === 'accepted' ? 'Accepting…' : 'Accept'}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => decide('reviewing')}>
              {busy === 'reviewing' ? '…' : 'Mark reviewing'}
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => decide('declined')}>
              {busy === 'declined' ? '…' : 'Decline'}
            </Button>
          </div>
        </div>
      )}

      {decided && result && (
        <p role="status" className={`mt-5 text-[13px] font-bold ${result.ok ? 'text-green' : 'text-alert'}`}>
          {result.message}
        </p>
      )}
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="im-micro">{label}</dt>
      <dd className="im-mono mt-1.5 text-[13px] font-bold">{value}</dd>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="im-micro">{label}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-white">{value}</p>
    </div>
  );
}
