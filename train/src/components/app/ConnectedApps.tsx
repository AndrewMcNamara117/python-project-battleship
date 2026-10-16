'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { disconnectProvider } from '@/app/actions/sync';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClass } from '@/components/ui/Button';

export interface ConnectedAppRow {
  name: string;
  label: string;
  available: boolean;
  connected: boolean;
  lastSyncAt: string | null;
  note: string | null;
}

export function ConnectedApps({ rows }: { rows: ConnectedAppRow[] }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <ul className="mt-5 space-y-4">
        {rows.map((r) => (
          <li key={r.name} className="border-b border-hairline pb-4 last:border-b-0">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[14px]">{r.label}</span>
              {r.connected ? (
                <Badge tone="green">Connected</Badge>
              ) : r.available ? (
                // a full navigation, not a fetch: the provider's sign-in page must take over the tab
                <a href={`/api/sync/${r.name}/connect`} className={buttonClass('ghost', 'sm')}>
                  Connect
                </a>
              ) : (
                <Badge tone="neutral">{r.name === 'strava' ? 'Not offered' : 'Coming'}</Badge>
              )}
            </div>
            {r.connected && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-tertiary">
                <span>
                  {r.lastSyncAt
                    ? `Last activity arrived ${new Date(r.lastSyncAt).toLocaleString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                    : 'New activities arrive here automatically.'}
                </span>
                <Button
                  variant="quiet"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r2 = await disconnectProvider(r.name);
                      setMessage(r2.message);
                      router.refresh();
                    })
                  }
                >
                  Disconnect
                </Button>
              </div>
            )}
            {!r.connected && r.note && <p className="mt-1.5 text-[12px] leading-relaxed text-ink-tertiary">{r.note}</p>}
          </li>
        ))}
      </ul>
      {message && (
        <p role="status" className="mt-4 text-[13px] font-bold text-mint">
          {message}
        </p>
      )}
    </div>
  );
}
