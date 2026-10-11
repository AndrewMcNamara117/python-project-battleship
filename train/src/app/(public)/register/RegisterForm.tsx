'use client';

import { useState, useTransition } from 'react';
import { signUp, type AuthResult } from '@/app/actions/auth';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input } from '@/components/ui/Field';

export function RegisterForm() {
  const [result, setResult] = useState<AuthResult | null>(null);
  const [pending, start] = useTransition();

  if (result?.ok) {
    return (
      <div>
        <p className="im-eyebrow">Almost there</p>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">{result.message}</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      action={(fd) => start(async () => setResult(await signUp(fd)))}
      className="space-y-6"
    >
      <Field label="Full name" required error={result?.fieldErrors?.fullName}>
        {(p) => <Input name="fullName" autoComplete="name" {...p} />}
      </Field>
      <Field label="Email" required error={result?.fieldErrors?.email}>
        {(p) => <Input name="email" type="email" autoComplete="email" {...p} />}
      </Field>
      <Field
        label="Password"
        required
        hint="At least 8 characters."
        error={result?.fieldErrors?.password}
      >
        {(p) => <Input name="password" type="password" autoComplete="new-password" {...p} />}
      </Field>

      <div>
        <Checkbox
          name="acceptTerms"
          label="I accept the terms and privacy policy."
          description="Including that training and wellbeing data is stored and visible to my coach."
        />
        {result?.fieldErrors?.acceptTerms && (
          <p role="alert" className="mt-2 text-[12px] font-bold text-alert">
            {result.fieldErrors.acceptTerms}
          </p>
        )}
      </div>

      {result && !result.ok && (
        <p role="alert" className="text-[13px] font-bold leading-relaxed text-alert">
          {result.message}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? 'Creating…' : 'Create account'}
      </Button>
    </form>
  );
}
