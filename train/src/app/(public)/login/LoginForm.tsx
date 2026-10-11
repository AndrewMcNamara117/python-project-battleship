'use client';

import { useState, useTransition } from 'react';
import { signIn, type AuthResult } from '@/app/actions/auth';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

export function LoginForm() {
  const [result, setResult] = useState<AuthResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      noValidate
      action={(fd) => start(async () => setResult(await signIn(fd)))}
      className="space-y-6"
    >
      <Field label="Email" required error={result?.fieldErrors?.email}>
        {(p) => <Input name="email" type="email" autoComplete="email" {...p} />}
      </Field>
      <Field label="Password" required error={result?.fieldErrors?.password}>
        {(p) => <Input name="password" type="password" autoComplete="current-password" {...p} />}
      </Field>

      {result && !result.ok && (
        <p role="alert" className="text-[13px] leading-relaxed font-bold text-alert">
          {result.message}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Checking…' : 'Log in'}
      </Button>
    </form>
  );
}
