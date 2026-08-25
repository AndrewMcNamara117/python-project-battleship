'use client';

import { useState, useTransition } from 'react';
import { messageAthlete, type Result } from '@/app/actions/coach';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';

export function ReplyBox({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const [body, setBody] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <Field label={`Reply to ${athleteName}`}>
        {(p) => (
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} {...p} />
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
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set('body', body);
            const r = await messageAthlete(athleteId, fd);
            setResult(r);
            if (r.ok) setBody('');
          })
        }
      >
        {pending ? 'Sending…' : 'Send'}
      </Button>
    </div>
  );
}
