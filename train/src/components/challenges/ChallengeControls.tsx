'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { archiveChallenge, createChallenge, joinChallenge, type ChallengeResult } from '@/app/actions/challenges';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { METRICS, type ChallengeMetric } from '@/lib/domain/challenges';

export function JoinChallenge({ challengeId, joined }: { challengeId: string; joined: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant={joined ? 'quiet' : 'solid'}
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await joinChallenge(challengeId, !joined);
            setResult(r);
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? '…' : joined ? 'Leave' : 'Join'}
      </Button>
      {result && !result.ok && (
        <span role="status" className="text-[12px] font-bold text-status-missed">
          {result.message}
        </span>
      )}
    </div>
  );
}

export function ArchiveChallenge({ challengeId, archived }: { challengeId: string; archived: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="quiet"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await archiveChallenge(challengeId, !archived);
          router.refresh();
        })
      }
    >
      {pending ? '…' : archived ? 'Bring back' : 'Retire'}
    </Button>
  );
}

export function NewChallenge({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [metric, setMetric] = useState<ChallengeMetric>('sessions');
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-5"
      action={(fd) =>
        start(async () => {
          fd.set('metric', metric);
          const r = await createChallenge(fd);
          setResult(r);
          if (r.ok) router.refresh();
        })
      }
    >
      <Field label="Name">{(p) => <Input name="name" maxLength={80} placeholder="e.g. November: twenty sessions as written" {...p} />}</Field>
      <Field label="Description (optional)">{(p) => <Textarea name="description" rows={2} maxLength={400} {...p} />}</Field>
      <fieldset>
        <legend className="block text-[11px] font-bold uppercase tracking-[0.2em] text-ink-secondary">What counts</legend>
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {(Object.keys(METRICS) as ChallengeMetric[]).map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer items-center gap-3 rounded-xs border px-3 py-2.5 text-[13px] ${
                metric === m ? 'border-mint text-ink' : 'border-hairline-strong text-ink-secondary'
              }`}
            >
              <input type="radio" name="metric-choice" checked={metric === m} onChange={() => setMetric(m)} className="accent-[var(--color-mint)]" />
              {METRICS[m].label}
            </label>
          ))}
        </div>
        {metric === 'distance_km' && (
          <p className="mt-2 text-[12px] leading-relaxed text-status-progress">
            A distance target rewards volume. Fine for a club month; worth pairing with a sessions challenge so nobody
            chases kilometres their plan did not ask for.
          </p>
        )}
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label={`Target (${METRICS[metric].unit})`}>
          {(p) => (
            <Input
              name="target"
              type="number"
              min={METRICS[metric].integer ? 1 : 0.1}
              step={METRICS[metric].integer ? 1 : 0.1}
              inputMode="decimal"
              required
              {...p}
            />
          )}
        </Field>
        <Field label="Starts">{(p) => <Input name="startsOn" type="date" defaultValue={defaultStart} required {...p} />}</Field>
        <Field label="Ends">{(p) => <Input name="endsOn" type="date" defaultValue={defaultEnd} required {...p} />}</Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Setting…' : 'Set challenge'}
        </Button>
        {result && (
          <p role="status" className={`text-[13px] font-bold ${result.ok ? 'text-mint' : 'text-status-missed'}`}>
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}
