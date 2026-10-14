'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { importActivityFile, type ImportResult } from '@/app/actions/activities';
import { buttonClass } from '@/components/ui/Button';

/**
 * Drop watch files here.
 *
 * Several at once is the common case — someone catching up on a week — so
 * files go one after another, each with its own line saying what happened
 * to it. The browser gzips each file before sending: GPX shrinks about ten
 * times, which keeps a 12-hour ultra under the platform's request ceiling,
 * and the server reads gzip anyway because that is how Strava exports.
 */

const ACCEPT = '.fit,.gpx,.tcx,.gz';
const MAX_CLIENT_BYTES = 25 * 1024 * 1024;

interface Row {
  key: string;
  name: string;
  state: 'waiting' | 'sending' | 'done';
  result?: ImportResult;
}

async function compress(file: File): Promise<Blob> {
  // already compressed, or no CompressionStream (older Safari): send as is
  if (/\.gz$/i.test(file.name) || typeof CompressionStream === 'undefined') return file;
  const stream = file.stream().pipeThrough(new CompressionStream('gzip'));
  return await new Response(stream).blob();
}

const TONE: Record<NonNullable<ImportResult['status']>, string> = {
  matched: 'text-mint',
  enriched: 'text-mint',
  ambiguous: 'text-status-progress',
  unmatched: 'text-ink-body',
  duplicate: 'text-ink-secondary',
};

export function ImportDropzone() {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function run(files: File[]) {
    if (!files.length || busy) return;
    const batch: Row[] = files.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, state: 'waiting' }));
    setRows((rs) => [...batch, ...rs].slice(0, 40));
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const row = batch[i];
        if (file.size > MAX_CLIENT_BYTES) {
          update(row.key, { state: 'done', result: { ok: false, message: 'Over 25 MB — too large to be one activity.' } });
          continue;
        }
        update(row.key, { state: 'sending' });
        try {
          const body = new FormData();
          body.set('file', await compress(file), `${file.name}${/\.gz$/i.test(file.name) ? '' : '.gz'}`);
          update(row.key, { state: 'done', result: await importActivityFile(body) });
        } catch {
          update(row.key, { state: 'done', result: { ok: false, message: 'The upload did not reach the server. Check your connection and try again.' } });
        }
      }
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void run(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center justify-center gap-4 rounded-xs border border-dashed px-6 py-10 text-center transition-colors duration-200 ${
          over ? 'border-mint bg-mint/5' : 'border-hairline-strong bg-onyx/40'
        }`}
      >
        <p className="text-[15px] font-bold text-ink">Drop watch files here</p>
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-secondary">
          .fit, .gpx or .tcx — from Garmin, COROS, Suunto, Polar, Wahoo or a Strava export. Several at once is fine.
        </p>
        <label className={buttonClass('ghost', 'md', busy ? 'pointer-events-none opacity-50' : 'cursor-pointer')}>
          {busy ? 'Importing…' : 'Choose files'}
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(e) => void run(Array.from(e.target.files ?? []))}
          />
        </label>
      </div>

      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline rounded-xs border border-hairline" aria-live="polite">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-[13px]">
              <span className="min-w-0 truncate font-bold text-ink-body">{r.name}</span>
              {r.state !== 'done' ? (
                <span className="text-ink-tertiary">{r.state === 'sending' ? 'Reading…' : 'Waiting'}</span>
              ) : (
                <span className={`flex flex-wrap items-baseline gap-x-3 ${r.result?.ok ? TONE[r.result.status ?? 'unmatched'] : 'text-status-missed'}`}>
                  {r.result?.message}
                  {r.result?.activityId && (
                    <Link href={`/app/activities/${r.result.activityId}`} className="im-micro text-mint hover:underline">
                      {r.result.status === 'ambiguous' ? 'Choose' : 'Open'}
                    </Link>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
