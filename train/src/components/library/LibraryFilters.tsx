'use client';

import { useRef, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Checkbox, Input, Select } from '@/components/ui/Field';

/**
 * Filtering lives in the URL.
 *
 * A coach who has narrowed to "threshold sessions I wrote" can send that link
 * to themselves, reload it, or come back to it tomorrow. The database does the
 * filtering either way — this only decides what to ask for.
 */
export function LibraryFilters({
  categories,
  categoryLabel = 'categories',
  extra,
}: {
  categories: { value: string; label: string }[];
  /** Plural, lowercase — it reads as "All categories" in the empty option. */
  categoryLabel?: string;
  extra?: { name: string; label: string; options: { value: string; label: string }[] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const search = params.get('q') ?? '';

  const push = (next: URLSearchParams) => {
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  };

  // debounce so a coach typing "thresh" does not fire six queries
  const onSearch = (value: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => set('q', value.trim()), 300);
  };

  // the selects size to their content rather than filling the row
  const selectClass = 'w-full sm:w-[11rem]';

  return (
    <div
      className={`flex flex-wrap items-center gap-3 ${pending ? 'opacity-70' : ''} transition-opacity duration-150`}
      role="search"
    >
      <label className="sr-only" htmlFor="library-search">
        Search the library
      </label>
      <Input
        id="library-search"
        type="search"
        // the URL owns this value; the key re-seeds the box when it changes
        // underneath the page, on a back button or a cleared filter
        key={search}
        defaultValue={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search"
        className="w-full sm:w-[16rem]"
      />

      <label className="sr-only" htmlFor="library-category">
        Filter by category
      </label>
      <Select
        id="library-category"
        className={selectClass}
        value={params.get('category') ?? ''}
        onChange={(e) => set('category', e.target.value)}
      >
        <option value="">All {categoryLabel}</option>
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>

      {extra && (
        <>
          <label className="sr-only" htmlFor={`library-${extra.name}`}>
            Filter by {extra.label}
          </label>
          <Select
            id={`library-${extra.name}`}
            className={selectClass}
            value={params.get(extra.name) ?? ''}
            onChange={(e) => set(extra.name, e.target.value)}
          >
            <option value="">All {extra.label}</option>
            {extra.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </>
      )}

      <label className="sr-only" htmlFor="library-owner">
        Filter by who owns it
      </label>
      <Select
        id="library-owner"
        className={selectClass}
        value={params.get('visibility') ?? ''}
        onChange={(e) => set('visibility', e.target.value)}
      >
        <option value="">Everything</option>
        <option value="private">Mine only</option>
        <option value="shared">Shared by coaches</option>
        <option value="system">Iron Miles</option>
      </Select>

      <Checkbox
        label="Show archived"
        checked={params.get('archived') === '1'}
        onChange={(e) => set('archived', e.target.checked ? '1' : '')}
      />
    </div>
  );
}
