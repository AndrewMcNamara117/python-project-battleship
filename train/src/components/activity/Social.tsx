'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { postComment, removeComment, setActivitySharing, toggleKudos, type ActivityResult } from '@/app/actions/activities';
import { Button } from '@/components/ui/Button';
import type { ActivityComment } from '@/lib/activity/types';

/**
 * The social controls. Small on purpose: kudos is one tap, a comment is one
 * line, and sharing says exactly what the club will see before it happens.
 */

export function KudosButton({
  activityId,
  given,
  count,
  disabled = false,
}: {
  activityId: string;
  given: boolean;
  count: number;
  /** Your own activity: you cannot give yourself kudos, but you see the count. */
  disabled?: boolean;
}) {
  const [state, setState] = useOptimistic({ given, count });
  const [, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={disabled ? undefined : state.given}
      aria-label={disabled ? `${state.count} kudos` : state.given ? `Take back kudos (${state.count})` : `Give kudos (${state.count})`}
      onClick={() =>
        start(async () => {
          const next = !state.given;
          setState({ given: next, count: state.count + (next ? 1 : -1) });
          const r = await toggleKudos(activityId, next);
          if (r.ok) router.refresh();
        })
      }
      className={`inline-flex items-center gap-2 rounded-xs border px-3 py-1.5 text-[12px] font-bold tabular-nums transition-colors duration-200 ${
        state.given ? 'border-mint bg-mint/10 text-mint' : 'border-hairline-strong text-ink-secondary hover:border-mint hover:text-mint'
      } disabled:pointer-events-none disabled:border-hairline`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={state.given ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" aria-hidden>
        {/* the Iron Miles chevron, pointing forward */}
        <path d="M5 18 12 6l7 12h-4.2L12 13.2 9.2 18z" strokeLinejoin="round" />
      </svg>
      {state.count}
    </button>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

export function CommentThread({
  activityId,
  comments,
  viewerId,
  canModerate,
  canComment,
}: {
  activityId: string;
  comments: ActivityComment[];
  viewerId: string;
  /** The activity's athlete, or staff: may remove anyone's comment. */
  canModerate: boolean;
  canComment: boolean;
}) {
  const [body, setBody] = useState('');
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div>
      {comments.length ? (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-hairline-strong text-[11px] font-bold text-ink-secondary"
                aria-hidden
              >
                {c.authorName.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px]">
                  <span className="font-bold text-ink">{c.authorName}</span>
                  <span className="ml-2 text-ink-tertiary">{when(c.createdAt)}</span>
                </p>
                <p className="mt-1 text-[14px] leading-relaxed break-words text-ink-body">{c.body}</p>
                {(c.authorId === viewerId || canModerate) && (
                  <button
                    type="button"
                    className="mt-1 text-[11px] font-bold text-ink-tertiary hover:text-status-missed"
                    onClick={() =>
                      start(async () => {
                        await removeComment(c.id, activityId);
                        router.refresh();
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-tertiary">No comments yet.</p>
      )}

      {canComment && (
        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start"
          action={() =>
            start(async () => {
              const r = await postComment(activityId, body);
              setResult(r);
              if (r.ok) {
                setBody('');
                router.refresh();
              }
            })
          }
        >
          <label className="sr-only" htmlFor={`comment-${activityId}`}>
            Add a comment
          </label>
          <textarea
            id={`comment-${activityId}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Say something encouraging"
            className="min-h-[2.75rem] w-full flex-1 resize-y rounded-xs border border-hairline-strong bg-onyx px-3 py-2.5 text-[14px] text-ink-body placeholder:text-ink-tertiary focus:border-mint focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            {pending ? 'Posting…' : 'Post'}
          </Button>
        </form>
      )}
      {result && !result.ok && (
        <p role="status" className="mt-2 text-[13px] font-bold text-status-missed">
          {result.message}
        </p>
      )}
    </div>
  );
}

export function ShareToggle({ activityId, shared }: { activityId: string; shared: boolean }) {
  const [on, setOn] = useState(shared);
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            start(async () => {
              const r = await setActivitySharing(activityId, next);
              setResult(r);
              if (!r.ok) setOn(!next);
              else router.refresh();
            });
          }}
          className="mt-0.5 h-4 w-4 accent-[var(--color-mint)]"
        />
        <span>
          <span className="block text-[14px] font-bold text-ink">Share with the club</span>
          <span className="mt-1 block text-[12px] leading-relaxed text-ink-secondary">
            Members see the route with its ends hidden, the distance, time, pace and climb. Never your heart rate,
            and never the plan it was matched to.
          </span>
        </span>
      </label>
      {result && (
        <p role="status" className={`text-[12px] font-bold ${result.ok ? 'text-mint' : 'text-status-missed'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
