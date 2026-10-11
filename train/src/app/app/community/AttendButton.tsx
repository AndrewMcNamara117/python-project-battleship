'use client';

import { useState, useTransition } from 'react';
import { toggleEventAttendance } from '@/app/actions/training';
import { Button } from '@/components/ui/Button';

export function AttendButton({
  eventId,
  full,
  attending,
}: {
  eventId: string;
  full: boolean;
  attending: boolean;
}) {
  // seeded from the server, so the answer survives a reload
  const [going, setGoing] = useState(attending);
  const [pending, start] = useTransition();

  return (
    <Button
      variant={going ? 'ghost' : 'solid'}
      size="sm"
      disabled={pending || (full && !going)}
      onClick={() =>
        start(async () => {
          const next = !going;
          setGoing(next);
          const result = await toggleEventAttendance(eventId, next);
          if (!result.ok) setGoing(!next);
        })
      }
    >
      {pending ? '…' : going ? "You're in" : full ? 'Full' : "I'm in"}
    </Button>
  );
}
