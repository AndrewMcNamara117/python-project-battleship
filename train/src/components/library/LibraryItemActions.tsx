'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { LibraryKind } from '@/lib/data/repo';
import { duplicateLibraryItem, setLibraryArchived } from '@/app/actions/library';

/**
 * What a coach can do to a library item without opening it.
 *
 * Shipped content offers only "duplicate" — the database refuses to edit it,
 * and offering a control that cannot work is worse than not offering it.
 */
export function LibraryItemActions({
  kind,
  id,
  name,
  ownedByMe,
  isSystem,
  archived,
  onEdit,
}: {
  kind: LibraryKind;
  id: string;
  name: string;
  ownedByMe: boolean;
  isSystem: boolean;
  archived: boolean;
  onEdit?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.message);
      else router.refresh();
    });

  return (
    <div className="mt-5 border-t border-hairline pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {ownedByMe && !isSystem && onEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} disabled={pending}>
            Edit
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run(() => duplicateLibraryItem(kind, id, `${name} (copy)`))}
        >
          Duplicate
        </Button>

        {ownedByMe && !isSystem && (
          <Button
            variant={archived ? 'ghost' : 'quiet'}
            size="sm"
            disabled={pending}
            onClick={() => run(() => setLibraryArchived(kind, id, !archived))}
          >
            {archived ? 'Restore' : 'Archive'}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12px] leading-relaxed text-status-missed">
          {error}
        </p>
      )}
    </div>
  );
}
