'use client';

import { useState, useTransition } from 'react';
import { addCoachNote, respondToCheckIn, type Result } from '@/app/actions/coach';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Textarea } from '@/components/ui/Field';

export function CoachNoteForm({ athleteId }: { athleteId: string }) {
  const [body, setBody] = useState('');
  const [shared, setShared] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <Field label="Add a note">
        {(p) => (
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What you noticed, and what you plan to do about it."
            {...p}
          />
        )}
      </Field>

      <Checkbox
        label="Share this note with the athlete"
        description="Unshared notes are yours alone — the database will not return them to the athlete."
        checked={shared}
        onChange={(e) => setShared(e.target.checked)}
      />

      {result && (
        <p role="status" className={`text-[12px] font-bold ${result.ok ? 'text-green' : 'text-alert'}`}>
          {result.message}
        </p>
      )}

      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await addCoachNote(athleteId, body, shared ? 'shared' : 'private');
            setResult(r);
            if (r.ok) setBody('');
          })
        }
      >
        {pending ? 'Saving…' : 'Save note'}
      </Button>
    </div>
  );
}

export function CheckInResponder({
  checkInId,
  athleteId,
  existing,
}: {
  checkInId: string;
  athleteId?: string;
  existing: string | null;
}) {
  const [body, setBody] = useState(existing ?? '');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <Field label="Respond to this check-in">
        {(p) => (
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What you are changing, and why."
            {...p}
          />
        )}
      </Field>

      {result && (
        <p role="status" className={`text-[12px] font-bold ${result.ok ? 'text-green' : 'text-alert'}`}>
          {result.message}
        </p>
      )}

      <Button
        size="sm"
        disabled={pending}
        onClick={() => start(async () => setResult(await respondToCheckIn(checkInId, athleteId ?? '', body)))}
      >
        {pending ? 'Sending…' : existing ? 'Update response' : 'Send response'}
      </Button>
    </div>
  );
}
