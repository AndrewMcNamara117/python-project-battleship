'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { importActivityFile, type ImportResult } from '@/app/actions/activities';
import { Button, buttonClass } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Field';
import {
  addFix,
  canSave,
  currentPace,
  elapsedActiveMs,
  pause,
  resume,
  startRecording,
  toTcx,
  type RecorderState,
} from '@/lib/activity/recorder';
import { formatDuration, formatPace } from '@/lib/domain/dates';
import type { Units } from '@/lib/domain/types';

/**
 * Record a run in the browser.
 *
 * Honest about what a browser can do: GPS runs while this page is on screen.
 * A wake lock keeps the screen from sleeping, but if the phone is locked the
 * browser stops sending positions, and the page says so when it comes back.
 * The track stays on the phone until Save, then goes through the same import
 * as a watch file. It is also kept on the phone as it grows, so a crashed tab
 * or a refresh does not lose a run.
 */

const STORE_KEY = 'im.recording.v1';
type Phase = 'idle' | 'acquiring' | 'active' | 'review' | 'saving' | 'saved';

function store(s: RecorderState | null) {
  try {
    if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode or full storage: recording still works, it just is not crash-safe */
  }
}

/** The stored text: a string is a stable snapshot, so useSyncExternalStore can read it without an effect. */
function readStored(): string | null {
  try {
    return localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}
const subscribeToNothing = () => () => {};

function parseStored(raw: string | null): RecorderState | null {
  try {
    if (!raw) return null;
    const s = JSON.parse(raw) as RecorderState;
    return Array.isArray(s.points) && typeof s.distanceM === 'number' ? s : null;
  } catch {
    return null;
  }
}

async function gzip(text: string): Promise<Blob> {
  const blob = new Blob([text], { type: 'application/xml' });
  if (typeof CompressionStream === 'undefined') return blob;
  return await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();
}

const km = (m: number, units: Units) => (units === 'imperial' ? m / 1609.344 : m / 1000).toFixed(2);

export function Recorder({ units }: { units: Units }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [sport, setSport] = useState<'run' | 'ride'>('run');
  const [state, setState] = useState<RecorderState | null>(null);
  // an unfinished recording from a crashed or refreshed tab — read on the
  // client only, so the server render and the first client render agree
  const storedRaw = useSyncExternalStore(subscribeToNothing, readStored, () => null);
  const [dismissedStored, setDismissedStored] = useState(false);
  const stored = useMemo(() => parseStored(storedRaw), [storedRaw]);
  const saved = dismissedStored ? null : stored;
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [gap, setGap] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const stateRef = useRef<RecorderState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // the clock
  useEffect(() => {
    if (phase !== 'active') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const lockScreen = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock) wakeLock.current = await nav.wakeLock.request('screen');
    } catch {
      /* not supported, or refused: the warning on screen covers it */
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  const watch = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('This browser cannot read GPS. Record on your watch and import the file instead.');
      setPhase('idle');
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setAccuracy(Math.round(pos.coords.accuracy));
        setPhase((p) => (p === 'acquiring' ? 'active' : p));
        setState((s) => {
          if (!s) return s;
          const next = addFix(s, {
            t: pos.timestamp,
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
          });
          if (next.points.length !== s.points.length && next.points.length % 10 === 0) store(next);
          return next;
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stopWatching();
          setError('Location is turned off for this site. Allow it in your browser settings, then start again.');
          setPhase('idle');
          setState(null);
        }
        // timeouts and unavailable fixes are normal under trees; keep waiting
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
  }, [stopWatching]);

  // the browser stops GPS when the page is hidden; say so when it comes back
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
      } else {
        if (hiddenAt.current && stateRef.current?.status === 'recording') {
          const away = Date.now() - hiddenAt.current;
          if (away > 15_000) setGap(Math.round(away / 60_000));
          void lockScreen();
        }
        hiddenAt.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [lockScreen]);

  useEffect(() => () => stopWatching(), [stopWatching]);

  function start(from?: RecorderState) {
    setError(null);
    setResult(null);
    setGap(null);
    const s = from ? resume({ ...from, status: 'paused', resumedAt: null }, Date.now()) : startRecording(sport, Date.now());
    setState(s);
    setDismissedStored(true);
    store(s);
    setPhase(from ? 'active' : 'acquiring');
    void lockScreen();
    watch();
  }

  function togglePause() {
    setState((s) => {
      if (!s) return s;
      const next = s.status === 'recording' ? pause(s, Date.now()) : resume(s, Date.now());
      store(next);
      return next;
    });
  }

  function finish() {
    stopWatching();
    setState((s) => {
      if (!s) return s;
      const next = s.status === 'recording' ? pause(s, Date.now()) : s;
      store(next);
      return next;
    });
    setPhase('review');
  }

  function discard() {
    stopWatching();
    store(null);
    setState(null);
    setDismissedStored(true);
    setPhase('idle');
  }

  async function save() {
    if (!state) return;
    setPhase('saving');
    try {
      const body = new FormData();
      body.set('file', await gzip(toTcx(state)), 'recording.tcx.gz');
      const r = await importActivityFile(body);
      setResult(r);
      if (r.ok) {
        store(null);
        setPhase('saved');
      } else {
        setPhase('review');
      }
    } catch {
      setResult({ ok: false, message: 'The recording did not reach the server. It is still on this phone — try again with a signal.' });
      setPhase('review');
    }
  }

  const active = state ? elapsedActiveMs(state, now) : 0;
  const pace = state ? currentPace(state) : null;
  const avgPace = state && state.distanceM > 50 ? Math.round(active / 1000 / (state.distanceM / 1000)) : null;
  const saveable = state ? canSave(state, now) : { ok: false };
  const weak = accuracy != null && accuracy > 25;

  /* ---------- idle ---------- */
  if (phase === 'idle') {
    return (
      <div className="space-y-6">
        {saved && (
          <div className="rounded-xs border border-status-progress/40 p-4">
            <p className="text-[14px] font-bold text-ink">An unfinished recording is on this phone</p>
            <p className="mt-1 text-[13px] text-ink-secondary">
              {km(saved.distanceM, units)} {units === 'imperial' ? 'mi' : 'km'}, started{' '}
              {new Date(saved.startedAt).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button size="sm" onClick={() => start(saved)}>
                Carry on
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setState(saved);
                  setPhase('review');
                }}
              >
                Finish it
              </Button>
              <Button size="sm" variant="quiet" onClick={discard}>
                Discard
              </Button>
            </div>
          </div>
        )}
        <div>
          <p className="im-micro mb-2.5">Recording a</p>
          <Segmented
            options={[
              { value: 'run', label: 'Run' },
              { value: 'ride', label: 'Ride' },
            ]}
            value={sport}
            onChange={setSport}
            ariaLabel="Sport"
          />
        </div>
        <Button size="lg" onClick={() => start()} className="w-full sm:w-auto">
          Start
        </Button>
        {error && (
          <p role="alert" className="text-[13px] font-bold text-status-missed">
            {error}
          </p>
        )}
        <ul className="space-y-2 text-[12px] leading-relaxed text-ink-tertiary">
          <li>Keep this page open and the screen on. A browser stops GPS when the phone locks; a watch does not.</li>
          <li>Nothing leaves your phone until you save. Saved runs are trimmed for privacy like any import.</li>
        </ul>
      </div>
    );
  }

  /* ---------- saved ---------- */
  if (phase === 'saved' && result) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-[15px] font-bold text-mint">
          {result.message}
        </p>
        <div className="flex flex-wrap gap-3">
          {result.activityId && (
            <Link href={`/app/activities/${result.activityId}`} className={buttonClass('solid', 'md')}>
              Open the activity
            </Link>
          )}
          <Button variant="ghost" onClick={() => setPhase('idle')}>
            Record another
          </Button>
        </div>
      </div>
    );
  }

  /* ---------- acquiring, active, review, saving ---------- */
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[12px]" aria-live="polite">
        <span
          className={`h-2 w-2 rounded-full ${phase === 'acquiring' || weak ? 'bg-status-progress' : 'bg-mint'} motion-safe:animate-pulse`}
          aria-hidden
        />
        <span className="text-ink-secondary">
          {phase === 'acquiring'
            ? 'Finding GPS — stand in the open for a moment'
            : phase === 'review' || phase === 'saving'
              ? 'Finished'
              : state?.status === 'paused'
                ? 'Paused'
                : weak
                  ? `Weak GPS (±${accuracy} m)`
                  : `Recording${accuracy != null ? ` · GPS ±${accuracy} m` : ''}`}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xs border border-hairline bg-hairline">
        <div className="col-span-2 bg-charcoal px-5 py-5">
          <dt className="im-micro">Time</dt>
          <dd className="im-figure mt-2 text-[clamp(3rem,14vw,4.5rem)] leading-none tabular-nums">{formatDuration(active / 1000)}</dd>
        </div>
        <div className="bg-charcoal px-5 py-4">
          <dt className="im-micro">Distance</dt>
          <dd className="im-figure mt-2 text-[2rem] tabular-nums">
            {km(state?.distanceM ?? 0, units)}
            <span className="ml-1 text-[14px] text-ink-secondary">{units === 'imperial' ? 'mi' : 'km'}</span>
          </dd>
        </div>
        <div className="bg-charcoal px-5 py-4">
          <dt className="im-micro">{phase === 'active' && state?.status === 'recording' ? 'Pace now' : 'Average pace'}</dt>
          <dd className="im-figure mt-2 text-[2rem] tabular-nums">
            {formatPace(phase === 'active' && state?.status === 'recording' ? pace : avgPace, units).replace(/ \/.+$/, '')}
          </dd>
        </div>
      </dl>

      {gap != null && (
        <p role="alert" className="text-[13px] leading-relaxed text-status-progress">
          The screen was off for about {gap} min and the browser recorded nothing in that time. Keep the screen on for an
          unbroken track.
        </p>
      )}

      {(phase === 'active' || phase === 'acquiring') && (
        <div className="flex gap-3">
          <Button size="lg" variant={state?.status === 'paused' ? 'solid' : 'ghost'} onClick={togglePause} className="flex-1" disabled={phase === 'acquiring'}>
            {state?.status === 'paused' ? 'Resume' : 'Pause'}
          </Button>
          <Button size="lg" variant="ghost" onClick={finish} className="flex-1">
            Finish
          </Button>
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && (
        <div className="space-y-4">
          {!saveable.ok && <p className="text-[13px] text-ink-secondary">{saveable.reason}</p>}
          {result && !result.ok && (
            <p role="alert" className="text-[13px] font-bold text-status-missed">
              {result.message}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={save} disabled={!saveable.ok || phase === 'saving'}>
              {phase === 'saving' ? 'Saving…' : 'Save'}
            </Button>
            <Button size="lg" variant="ghost" onClick={() => start(state ?? undefined)} disabled={phase === 'saving'}>
              Carry on
            </Button>
            <Button size="lg" variant="quiet" onClick={discard} disabled={phase === 'saving'}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
