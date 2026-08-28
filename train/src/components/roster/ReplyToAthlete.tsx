'use client';

import { useRef, useState, useTransition } from 'react';
import { messageAthlete } from '@/app/actions/coach';
import { Button } from '@/components/ui/Button';

/**
 * ANSWERING THE PERSON WHO IS WAITING.
 *
 * Before this, the roster told a coach that somebody had written and then
 * sent them to /coach/messages — a list of every conversation with every
 * athlete, where the person they had come for was somewhere below the fold.
 * The coach had to remember the name, find them, and reconstruct what was
 * being asked before they could type a word.
 *
 * So the box is here, next to what the athlete actually said. One athlete,
 * one reply, their words still on screen while it is written.
 *
 * It is deliberately singular. There is no "reply to all": sending the same
 * sentence to eleven people is not answering eleven people, and a product
 * that offers it will be used to do it.
 */
export function ReplyToAthlete({
  athleteId,
  athleteName,
  waited,
  latest,
  unanswered,
}: {
  athleteId: string;
  athleteName: string;
  /** How long they have been waiting, already in words. */
  waited: string;
  /** What they last said, so the coach answers the question in front of them. */
  latest: string;
  unanswered: number;
}) {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);

  const first = athleteName.split(' ')[0] || athleteName;

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="im-micro">
          Waiting {waited}
          {unanswered > 1 && ` · ${unanswered} messages`}
        </p>
      </div>

      {/* their words, kept in front of the coach rather than remembered */}
      <blockquote className="mt-2 border-l-2 border-hairline-strong pl-3 text-[13px] leading-relaxed text-ink-body">
        {latest}
      </blockquote>

      {sent ? (
        <p role="status" className="mt-3 text-[13px] text-mint">{sent}</p>
      ) : (
        <form
          className="mt-3"
          action={(formData) => start(async () => {
            const result = await messageAthlete(athleteId, formData);
            if (result.ok) setSent(`Replied to ${first}.`);
            else setError(result.message);
          })}
        >
          <label className="sr-only" htmlFor={`reply-${athleteId}`}>
            Reply to {athleteName}
          </label>
          <textarea
            ref={box}
            id={`reply-${athleteId}`}
            name="body"
            rows={2}
            required
            placeholder={`Reply to ${first}…`}
            className="im-scroll w-full resize-y rounded-xs border border-hairline-strong bg-slate px-3 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-tertiary focus-visible:border-mint focus-visible:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button type="submit" variant="ghost" size="sm" disabled={pending}>
              {pending ? 'Sending…' : 'Send reply'}
            </Button>
            {error && <span role="alert" className="text-[12px] text-status-missed">{error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
