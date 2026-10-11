'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

async function post(path: string): Promise<{ url?: string; error?: string }> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ packageCode: 'event_ready' }),
  });
  return response.json().catch(() => ({ error: 'Something went wrong' }));
}

export function BillingActions({ hasSubscription }: { hasSubscription: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(path: string, label: string) {
    setBusy(label);
    setError(null);
    const result = await post(path);
    if (result.url) {
      window.location.href = result.url;
      return;
    }
    setError(result.error ?? 'Something went wrong');
    setBusy(null);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {hasSubscription ? (
          <Button disabled={busy !== null} onClick={() => go('/api/stripe/portal', 'portal')}>
            {busy === 'portal' ? 'Opening…' : 'Manage billing'}
          </Button>
        ) : (
          <Button disabled={busy !== null} onClick={() => go('/api/stripe/checkout', 'checkout')}>
            {busy === 'checkout' ? 'Opening…' : 'Start subscription'}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[13px] font-bold leading-relaxed text-alert">
          {error}
        </p>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-muted-2">
        Card details are handled entirely by Stripe and never reach Iron Miles systems. Cancelling,
        pausing, updating your card and downloading invoices all happen in Stripe&apos;s own portal.
      </p>
    </div>
  );
}
