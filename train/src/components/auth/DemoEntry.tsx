'use client';

import { useTransition } from 'react';
import { enterDemo } from '@/app/actions/auth';
import { Button } from '@/components/ui/Button';

/**
 * Visible only while the deployment has no Supabase project attached.
 * Lets a reviewer walk the entire product — both roles — without an account.
 */
export function DemoEntry() {
  const [pending, start] = useTransition();

  return (
    <div className="mt-8 border-t border-line pt-7">
      <p className="im-micro text-green">Demo mode</p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        This deployment has no database attached yet, so the platform is running on a seeded demo
        dataset. Enter as either role to explore it end to end.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => start(() => void enterDemo('athlete'))}
        >
          Enter as athlete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => start(() => void enterDemo('coach'))}
        >
          Enter as coach
        </Button>
      </div>
    </div>
  );
}
