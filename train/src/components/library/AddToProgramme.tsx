'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { addTemplateToProgramme } from '@/app/actions/library';

/**
 * Prescribe a library session to an athlete.
 *
 * The session that lands is a copy. It records which template it came from and
 * nothing else connects them — so the coach can rewrite this template next
 * season without touching what the athlete has already run.
 */
export function AddToProgramme({
  kind,
  templateId,
  athletes,
  compact = false,
}: {
  kind: 'workout' | 'strength';
  templateId: string;
  athletes: { id: string; name: string }[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!athletes.length) {
    return (
      <p className="mt-4 text-[12px] text-ink-tertiary">
        No athletes on your roster yet — nobody to prescribe this to.
      </p>
    );
  }

  // the outcome outlives the form: on success the panel closes, and a coach
  // who got no confirmation cannot tell a prescription from a misclick
  const outcome = result && (
    <p
      role="status"
      className={`mt-3 text-[12px] leading-relaxed ${result.ok ? 'text-mint' : 'text-status-missed'}`}
    >
      {result.message}
    </p>
  );

  if (!open) {
    return (
      <div className="mt-4">
        <Button
          variant={compact ? 'quiet' : 'ghost'}
          size="sm"
          onClick={() => {
            setResult(null);
            setOpen(true);
          }}
        >
          Add to athlete
        </Button>
        {outcome}
      </div>
    );
  }

  const submit = () =>
    startTransition(async () => {
      const response = await addTemplateToProgramme(kind, templateId, athleteId, date);
      setResult(response);
      if (response.ok) {
        router.refresh();
        setOpen(false);
      }
    });

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Athlete
          <Select
            className="mt-1.5 w-full"
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
            disabled={pending}
          >
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Date
          <Input
            type="date"
            className="mt-1.5"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={pending}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !athleteId}>
          {pending ? 'Adding…' : 'Prescribe'}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>

      {outcome}
    </div>
  );
}
