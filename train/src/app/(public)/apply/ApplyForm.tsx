'use client';

import { useState, useTransition } from 'react';
import { submitApplication, type ActionResult } from '@/app/actions/public';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';

export function ApplyForm() {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok) {
    return (
      <Panel edge className="p-9 sm:p-12">
        <p className="im-eyebrow">Received</p>
        <h2 className="im-display mt-5 text-[clamp(1.8rem,4vw,2.6rem)]">
          That&apos;s the first session done.
        </h2>
        <p className="mt-5 max-w-[48ch] text-[15px] leading-relaxed text-muted">{result.message}</p>
        <p className="mt-8 border-t border-line pt-6 text-[13px] leading-relaxed text-muted-2">
          If it is not a fit, we will tell you that honestly and point you somewhere better. Nothing
          is charged until coaching actually starts.
        </p>
      </Panel>
    );
  }

  const err = (name: string) => result?.fieldErrors?.[name];

  return (
    <form
      noValidate
      action={(formData) => {
        startTransition(async () => setResult(await submitApplication(formData)));
      }}
      className="space-y-8"
    >
      <fieldset className="space-y-6" disabled={pending}>
        <legend className="im-micro mb-6">You</legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Full name" required error={err('fullName')}>
            {(p) => <Input name="fullName" autoComplete="name" {...p} />}
          </Field>
          <Field label="Email" required error={err('email')}>
            {(p) => <Input name="email" type="email" autoComplete="email" {...p} />}
          </Field>
        </div>
        <Field label="Phone" hint="Optional. Only used if email goes nowhere." error={err('phone')}>
          {(p) => <Input name="phone" type="tel" autoComplete="tel" {...p} />}
        </Field>
      </fieldset>

      <fieldset className="space-y-6 border-t border-line pt-8" disabled={pending}>
        <legend className="im-micro mb-6">The goal</legend>
        <Field
          label="What are you training for, and why that?"
          required
          hint="The why matters more than the what. It is the thing we read back to you in week fourteen."
          error={err('goal')}
        >
          {(p) => <Textarea name="goal" rows={5} {...p} />}
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Target race" hint="If you have picked one." error={err('targetRace')}>
            {(p) => <Input name="targetRace" placeholder="Connemara Ultra" {...p} />}
          </Field>
          <Field label="Race date" hint="An approximate date is fine." error={err('targetDate')}>
            {(p) => <Input name="targetDate" type="date" {...p} />}
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-6 border-t border-line pt-8" disabled={pending}>
        <legend className="im-micro mb-6">Where you are now</legend>
        <Field
          label="Current weekly volume"
          hint="Kilometres per week, roughly. Zero is a perfectly good answer."
          error={err('currentWeeklyKm')}
        >
          {(p) => <Input name="currentWeeklyKm" type="number" min={0} max={400} step={1} {...p} />}
        </Field>
        <Field
          label="Your training background"
          required
          hint="How long you have been running, what you have raced, whether you lift."
          error={err('experience')}
        >
          {(p) => <Textarea name="experience" rows={4} {...p} />}
        </Field>
        <Field
          label="Injuries or limitations"
          hint="Current or recent. This shapes the first block more than anything else here."
          error={err('injuries')}
        >
          {(p) => <Textarea name="injuries" rows={3} {...p} />}
        </Field>
        <Field label="When would you want to start?" required error={err('startWhen')}>
          {(p) => <Input name="startWhen" placeholder="As soon as there is a place" {...p} />}
        </Field>
      </fieldset>

      <div className="border-t border-line pt-8">
        <Checkbox
          name="consent"
          label="I consent to Iron Miles storing these details to assess my application."
          description="Health and training information is treated as sensitive. You can ask us to delete it at any time, and nothing here is shared outside Iron Miles."
        />
        {err('consent') && (
          <p role="alert" className="mt-2 text-[12px] font-bold text-alert">
            {err('consent')}
          </p>
        )}
      </div>

      {result && !result.ok && (
        <p role="alert" className="text-[13px] font-bold text-alert">
          {result.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-5">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Sending…' : 'Send application'}
        </Button>
        <p className="text-[12px] text-muted-2">No payment at this stage.</p>
      </div>
    </form>
  );
}
