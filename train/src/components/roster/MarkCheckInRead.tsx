'use client';

import { useState, useTransition } from 'react';
import { acknowledgeCheckIn } from '@/app/actions/coach';
import { Button } from '@/components/ui/Button';

/**
 * "I have read this."
 *
 * The smallest control in Slice 10 and the reason for it. A coach reading
 * thirty-one check-ins a week should not have to type a reply to twenty-five
 * athletes who had an ordinary week just to make a counter true.
 *
 * Two things it deliberately is not:
 *
 *   It is not automatic. Nothing marks a check-in read because a page
 *   rendered — the coach's attention is the thing being recorded, and
 *   inferring it from a scroll position would make the record worthless.
 *
 *   It is not a reply. Nothing is sent, no message is fabricated, and the
 *   athlete sees "read" rather than words their coach did not write.
 */
export function MarkCheckInRead({
  checkInId,
  athleteId,
  flagged,
}: {
  checkInId: string;
  athleteId: string;
  /** A flagged check-in stays on the roster after this. Say so. */
  flagged: boolean;
}) {
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return <p role="status" className="text-[13px] text-mint">{done}</p>;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => {
          const result = await acknowledgeCheckIn(checkInId, athleteId);
          setDone(result.ok ? result.message : null);
        })}
      >
        {pending ? 'Marking…' : 'Mark as read'}
      </Button>
      <span className="text-[12px] leading-relaxed text-ink-tertiary">
        {flagged
          ? 'Records that you read it. It stays flagged on your roster until you reply.'
          : 'Records that you read it. Nothing is sent.'}
      </span>
    </>
  );
}
