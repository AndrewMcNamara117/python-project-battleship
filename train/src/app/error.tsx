'use client';

import { useEffect } from 'react';
import { IronMilesMark } from '@/components/brand/IronMilesLogo';
import { Button, ButtonLink } from '@/components/ui/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // the digest is what ties this to a server log line
    console.error('Iron Miles Training error:', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="im-grain flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <IronMilesMark height={40} title="Iron Miles" />
      <p className="im-eyebrow mt-9">Something broke</p>
      <h1 className="im-display mt-5 text-[clamp(2rem,6vw,3.4rem)]">Not your fault.</h1>
      <p className="mt-5 max-w-[44ch] text-[15px] leading-relaxed text-muted">
        Something on our side failed. Your training data is untouched — nothing you logged is lost.
      </p>
      {error.digest && (
        <p className="im-mono mt-5 text-[11px] tracking-[0.14em] text-muted-2">
          Reference: {error.digest}
        </p>
      )}
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/app" variant="ghost">
          Back to the hub
        </ButtonLink>
      </div>
    </main>
  );
}
