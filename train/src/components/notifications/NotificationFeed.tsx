'use client';

import { useState, useTransition } from 'react';
import { markAllRead, markNotification } from '@/app/actions/notifications';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import type { NotificationItem } from '@/lib/data/repo';

/**
 * What Iron Miles told this coach, and what became of it.
 *
 * Every row states its own reason and leads where the coach can act. The
 * delivery line is deliberately visible: a product that says "we notified you"
 * without showing whether anything left the building is asking to be trusted
 * on something it has not checked.
 */

const TONE = {
  urgent: 'alert',
  attention: 'warn',
  information: 'neutral',
} as const;

function when(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

/** What actually happened to it, in a sentence rather than a status code. */
function deliveryLine(item: NotificationItem): string | null {
  if (!item.deliveries.length) return null;

  const parts = item.deliveries.map((d) => {
    const channel = d.channel === 'in_app' ? 'In Iron Miles' : 'Email';
    if (d.state === 'delivered') return `${channel}: sent`;
    if (d.state === 'pending') return `${channel}: not sent yet`;
    if (d.state === 'unavailable') return `${channel}: not set up on this deployment`;
    return `${channel}: failed — ${d.detail ?? 'no reason recorded'}`;
  });
  return parts.join(' · ');
}

export function NotificationFeed({ items }: { items: NotificationItem[] }) {
  const [pending, startTransition] = useTransition();
  const [cleared, setCleared] = useState<Set<string>>(new Set());

  const visible = items.filter((i) => !cleared.has(i.id));
  const unread = visible.filter((i) => i.state === 'pending').length;

  const act = (id: string, state: 'read' | 'dismissed') => {
    if (state === 'dismissed') setCleared((prev) => new Set(prev).add(id));
    startTransition(() => { void markNotification(id, state); });
  };

  if (!visible.length) {
    return (
      <Panel className="p-8 text-center">
        <p className="im-display text-[18px]">Nothing waiting</p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
          Iron Miles only tells you something when it would change what you do.
          A quiet morning here means a quiet morning on the roster.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="im-micro">{unread} unread</p>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => { void markAllRead(); })}
          >
            Mark all read
          </Button>
        </div>
      )}

      <ul className="space-y-3">
        {visible.map((item) => {
          const delivery = deliveryLine(item);
          return (
            <li key={item.id}>
              <Panel className={`p-5 ${item.state === 'pending' ? '' : 'opacity-70'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONE[item.priority]}>
                        {item.priority === 'information' ? 'Note' : item.priority}
                      </Badge>
                      {item.kind === 'digest' && <Badge tone="neutral">Daily</Badge>}
                      {item.state === 'pending' && <Badge tone="green">New</Badge>}
                      <span className="im-micro">{when(item.createdAt)}</span>
                    </div>

                    <p className="mt-3 text-[15px] font-bold uppercase tracking-[0.04em]">
                      {item.title}
                    </p>
                    {/* the athlete's own words, exactly as they wrote them */}
                    <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-ink-secondary">
                      {item.body}
                    </p>

                    {delivery && (
                      <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-ink-faint">
                        {delivery}
                      </p>
                    )}
                  </div>

                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
                    <ButtonLink href={item.href} variant="ghost" size="sm">
                      {item.athleteName ? `Open ${item.athleteName.split(' ')[0]}` : 'Open roster'}
                    </ButtonLink>
                    {item.state === 'pending' && (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => act(item.id, 'read')}>
                        Mark read
                      </Button>
                    )}
                    <Button variant="quiet" size="sm" disabled={pending} onClick={() => act(item.id, 'dismissed')}>
                      Clear
                    </Button>
                  </div>
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
