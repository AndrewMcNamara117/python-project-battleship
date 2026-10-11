'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { loadSessionHistory } from '@/app/actions/history';
import type { SessionHistory as History } from '@/lib/domain/adaptation';
import { formatDayMonth } from '@/lib/domain/dates';

/**
 * What happened to this session.
 *
 * Loaded on demand rather than with the page: most sessions have never been
 * changed, and a coach only asks about the ones that have.
 */
export function SessionHistory({ sessionId, revisions }: { sessionId: string; revisions: number }) {
  const [pending, startTransition] = useTransition();
  const [history, setHistory] = useState<History | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // one revision is the prescription itself; there is no story to tell
  if (revisions <= 1) return null;

  const toggle = () => {
    if (open) return setOpen(false);
    setOpen(true);
    if (history) return;
    startTransition(async () => {
      const result = await loadSessionHistory(sessionId);
      if (result.ok && result.history) setHistory(result.history);
      else setError(result.message);
    });
  };

  return (
    <div className="mt-3">
      <Button variant="quiet" size="sm" onClick={toggle} className="px-0">
        {open ? 'Hide history' : `History · ${revisions - 1} change${revisions - 1 === 1 ? '' : 's'}`}
      </Button>

      {open && (
        <div className="mt-3 border-l border-hairline-strong pl-4">
          {pending && <p className="text-[12px] text-ink-tertiary">Reading the record…</p>}
          {error && <p role="alert" className="text-[12px] text-status-missed">{error}</p>}

          {history && (
            <>
              {history.original && (
                <div className="pb-4">
                  <p className="im-micro">Originally prescribed</p>
                  <p className="mt-1.5 text-[13px] text-ink">
                    {String(history.original.name ?? 'Session')}
                    {history.original.date ? ` · ${formatDayMonth(String(history.original.date).slice(0, 10))}` : ''}
                    {history.original.distance_km ? ` · ${history.original.distance_km} km` : ''}
                  </p>
                </div>
              )}

              <ol className="space-y-3.5">
                {history.entries.slice(1).map((entry) => (
                  <li key={entry.revision} className="border-t border-hairline pt-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-[13px] font-semibold text-ink">{entry.headline}</p>
                      <p className="im-mono text-[11px] text-ink-tertiary">
                        {entry.by} · {formatDayMonth(entry.changedAt.slice(0, 10))}
                      </p>
                    </div>
                    {entry.changes.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {entry.changes.map((change) => (
                          <li key={change} className="im-mono text-[11.5px] leading-relaxed text-ink-secondary">
                            {change}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}
