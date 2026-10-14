'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setSegmentArchived } from '@/app/actions/segments';
import { Button } from '@/components/ui/Button';

export function ArchiveSegment({ segmentId, archived }: { segmentId: string; archived: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="quiet"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setSegmentArchived(segmentId, !archived);
          router.refresh();
        })
      }
    >
      {pending ? '…' : archived ? 'Bring back' : 'Retire'}
    </Button>
  );
}
