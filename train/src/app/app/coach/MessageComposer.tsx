'use client';

import { useRef, useState, useTransition } from 'react';
import { sendCoachMessage, type Result } from '@/app/actions/training';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';

export function MessageComposer({ coachName }: { coachName: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      noValidate
      action={(fd) =>
        start(async () => {
          const r = await sendCoachMessage(fd);
          setResult(r);
          if (r.ok) formRef.current?.reset();
        })
      }
      className="space-y-4"
    >
      <Field label={`Message ${coachName}`} error={result?.fieldErrors?.body}>
        {(p) => (
          <Textarea
            name="body"
            rows={4}
            placeholder="How a session went, something that is bothering you, or a question about the week."
            {...p}
          />
        )}
      </Field>

      {result && (
        <p role="status" className={`text-[12px] font-bold ${result.ok ? 'text-green' : 'text-alert'}`}>
          {result.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send'}
      </Button>
    </form>
  );
}
