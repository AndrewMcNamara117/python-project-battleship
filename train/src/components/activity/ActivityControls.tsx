'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  attachActivityToSession,
  deleteActivity,
  renameActivity,
  saveActivitySettings,
  type ActivityResult,
} from '@/app/actions/activities';
import { Button } from '@/components/ui/Button';
import { Field, Input, Segmented } from '@/components/ui/Field';

function Status({ result }: { result: ActivityResult | null }) {
  if (!result) return null;
  return (
    <p role="status" className={`text-[13px] font-bold ${result.ok ? 'text-mint' : 'text-status-missed'}`}>
      {result.message}
    </p>
  );
}

/** Which session was this? Shown only when the importer would not guess. */
export function AttachPicker({
  activityId,
  options,
}: {
  activityId: string;
  options: { id: string; label: string; detail: string }[];
}) {
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!options.length) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-secondary">
        Nothing on your plan that day or either side of it can take this activity. It stays in your activities, and
        your coach can still see it.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await attachActivityToSession(activityId, o.id);
                  setResult(r);
                  if (r.ok) router.refresh();
                })
              }
              className="flex w-full items-baseline justify-between gap-4 rounded-xs border border-hairline-strong px-4 py-3 text-left transition-colors hover:border-mint focus-visible:border-mint disabled:opacity-50"
            >
              <span className="font-bold text-ink">{o.label}</span>
              <span className="text-[12px] text-ink-secondary">{o.detail}</span>
            </button>
          </li>
        ))}
      </ul>
      <Status result={result} />
    </div>
  );
}

export function DeleteActivity({ activityId, createdLog }: { activityId: string; createdLog: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <Button variant="quiet" size="sm" onClick={() => setConfirming(true)}>
        Delete activity
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-xs border border-status-missed/30 p-4">
      <p className="text-[13px] leading-relaxed text-ink-body">
        {createdLog
          ? 'This file logged the session. Deleting it removes that log too, and the session goes back on your plan.'
          : 'Your typed log for the session stays as it is.'}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deleteActivity(activityId);
              setResult(r);
              if (r.ok) router.push('/app/activities');
            })
          }
        >
          {pending ? 'Deleting…' : 'Delete'}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Keep it
        </Button>
      </div>
      <Status result={result} />
    </div>
  );
}

export function RenameActivity({ activityId, name }: { activityId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!editing) {
    return (
      <Button variant="quiet" size="sm" onClick={() => setEditing(true)}>
        Rename
      </Button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      action={() =>
        start(async () => {
          const r = await renameActivity(activityId, value);
          setResult(r);
          if (r.ok) {
            setEditing(false);
            router.refresh();
          }
        })
      }
    >
      <Field label="Name" className="min-w-[14rem] flex-1">
        {(p) => <Input value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} autoFocus {...p} />}
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
      <Button type="button" variant="quiet" size="sm" onClick={() => setEditing(false)}>
        Cancel
      </Button>
      <Status result={result} />
    </form>
  );
}

const TRIMS = [
  { value: '0', label: 'Off' },
  { value: '200', label: '200 m' },
  { value: '500', label: '500 m' },
  { value: '1000', label: '1 km' },
] as const;

export function ActivitySettings({
  maxHeartRate,
  privacyTrimM,
  shareDefault,
}: {
  maxHeartRate: number | null;
  privacyTrimM: number;
  shareDefault: boolean;
}) {
  const [trim, setTrim] = useState(String(privacyTrimM) as (typeof TRIMS)[number]['value']);
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-6"
      action={(fd) => {
        fd.set('privacyTrimM', trim);
        start(async () => setResult(await saveActivitySettings(fd)));
      }}
    >
      <Field
        label="Max heart rate (bpm)"
        hint="From a lab test or a hard hill effort — not 220 minus age. Your zones are cut against it."
      >
        {(p) => (
          <Input
            name="maxHeartRate"
            type="number"
            inputMode="numeric"
            min={100}
            max={240}
            defaultValue={maxHeartRate ?? ''}
            placeholder="e.g. 186"
            {...p}
          />
        )}
      </Field>
      <div>
        <p className="im-micro mb-2.5">Hide the start and finish of every route</p>
        <Segmented options={[...TRIMS]} value={trim} onChange={setTrim} ariaLabel="Privacy distance" />
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-tertiary">
          A route that starts at your door shows where you live. The hidden stretch is removed before anything is
          stored, so it cannot be recovered later. Your distance and pace still count it.
        </p>
      </div>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" name="shareActivitiesDefault" defaultChecked={shareDefault} className="mt-0.5 h-4 w-4 accent-[var(--color-mint)]" />
        <span>
          <span className="block text-[14px] font-bold text-ink">Share new imports with the club</span>
          <span className="mt-1 block text-[12px] leading-relaxed text-ink-tertiary">
            Off by default. You can change any single activity either way afterwards.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
        <Status result={result} />
      </div>
    </form>
  );
}
