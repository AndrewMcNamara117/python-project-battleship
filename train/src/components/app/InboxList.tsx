'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { markRead } from '@/app/actions/notifications-athlete';
import { Button } from '@/components/ui/Button';
import type { Notification } from '@/lib/domain/types';

function when(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

/**
 * The athlete's inbox. Opening one marks it read; nothing is marked read by
 * merely loading the page — reading is an act, not a side effect.
 */
export function InboxList({ items }: { items: Notification[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] text-ink-secondary">{unread ? `${unread} unread` : 'All read'}</p>
        {unread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                // exactly the ones shown: one that arrived since the page loaded stays unread
                await markRead(items.filter((n) => !n.readAt).map((n) => n.id));
                router.refresh();
              })
            }
          >
            Mark all read
          </Button>
        )}
      </div>
      <ul className="mt-4 divide-y divide-hairline overflow-hidden rounded-xs border border-hairline">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  if (!n.readAt) await markRead([n.id]);
                  if (n.href) router.push(n.href);
                  else router.refresh();
                })
              }
              className="flex w-full items-start gap-3 bg-charcoal px-4 py-3.5 text-left transition-colors hover:bg-slate focus-visible:bg-slate"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-mint'}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] ${n.readAt ? 'text-ink-body' : 'font-bold text-ink'}`}>
                  {n.title}
                  {!n.readAt && <span className="sr-only"> (unread)</span>}
                </span>
                {n.body && <span className="mt-0.5 block truncate text-[13px] text-ink-secondary">{n.body}</span>}
              </span>
              <span className="shrink-0 text-[11px] text-ink-tertiary" suppressHydrationWarning>
                {when(n.createdAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
