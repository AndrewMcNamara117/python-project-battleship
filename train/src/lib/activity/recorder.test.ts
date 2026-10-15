import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { syntheticRun } from './fixtures.ts';
import { buildActivity, decodeFile } from './import.ts';
import { addFix, canSave, currentPace, elapsedActiveMs, pause, resume, startRecording, toTcx, type Fix, type RecorderState } from './recorder.ts';

const T0 = Date.parse('2026-10-15T07:00:00Z');
const fixesOf = (km: number, pace: number, startMs = T0) =>
  syntheticRun({ start: new Date(startMs).toISOString(), distanceKm: km, paceSecPerKm: pace, intervalS: 1 }).map(
    (p): Fix => ({ t: p.t as number, lat: p.lat as number, lon: p.lon as number, accuracy: 6, altitude: p.ele }),
  );
const feed = (s: RecorderState, fixes: Fix[]) => fixes.reduce(addFix, s);

describe('recording', () => {
  it('a clean 3 km comes out at 3 km', () => {
    const s = feed(startRecording('run', T0), fixesOf(3, 300));
    assert.ok(Math.abs(s.distanceM - 3000) < 30, `${s.distanceM}`);
    assert.equal(s.rejected, 0);
  });

  it('a slow jog and a walk still count — under 3 m a second is not standing still', () => {
    for (const pace of [450, 720]) {
      const s = feed(startRecording('run', T0), fixesOf(1, pace));
      assert.ok(Math.abs(s.distanceM - 1000) < 30, `${pace} s/km recorded ${s.distanceM} m`);
    }
  });

  it('throws away a vague fix and says how many', () => {
    const fixes = fixesOf(1, 300);
    fixes[100] = { ...fixes[100], accuracy: 80 };
    const s = feed(startRecording('run', T0), fixes);
    assert.equal(s.rejected, 1);
  });

  it('throws away a fix that teleports', () => {
    const fixes = fixesOf(1, 300);
    fixes[150] = { ...fixes[150], lat: fixes[150].lat + 0.05 };
    const s = feed(startRecording('run', T0), fixes);
    assert.equal(s.rejected, 1);
    assert.ok(s.distanceM < 1050);
  });

  it('standing still with GPS drifting adds no distance', () => {
    let s = startRecording('run', T0);
    for (let i = 0; i < 120; i++) {
      s = addFix(s, { t: T0 + i * 1000, lat: 52.67 + (i % 2 ? 0.00001 : -0.00001), lon: -8.57, accuracy: 8, altitude: null });
    }
    assert.equal(s.distanceM, 0);
  });

  it('ignores a fix that arrives out of order', () => {
    const fixes = fixesOf(0.5, 300);
    const s = feed(startRecording('run', T0), [...fixes, fixes[10]]);
    assert.equal(s.points.length, feed(startRecording('run', T0), fixes).points.length);
  });

  it('a pause stops the clock, and nothing walked while paused is counted', () => {
    const first = fixesOf(1, 300);
    let s = feed(startRecording('run', T0), first);
    const pausedAt = first[first.length - 1].t;
    s = pause(s, pausedAt);
    assert.equal(s.status, 'paused');
    // fixes while paused are ignored
    s = feed(s, fixesOf(0.3, 300, pausedAt + 1000).map((f) => ({ ...f, lat: f.lat + 0.01 })));
    const resumedAt = pausedAt + 600_000;
    s = resume(s, resumedAt);
    // resume 1 km away from where the pause began
    s = feed(s, fixesOf(1, 300, resumedAt).map((f) => ({ ...f, lat: f.lat + 0.01 })));
    assert.ok(Math.abs(s.distanceM - 2000) < 40, `distance ${s.distanceM}`);
    const active = elapsedActiveMs(s, resumedAt + 300_000) / 1000;
    assert.ok(Math.abs(active - 600) < 3, `active ${active}`);
  });

  it('current pace over the last half-minute', () => {
    const s = feed(startRecording('run', T0), fixesOf(1, 300));
    const p = currentPace(s)!;
    assert.ok(Math.abs(p - 300) < 10, `${p}`);
    assert.equal(currentPace(startRecording('run', T0)), null);
  });

  it('will not save a pocket-dial', () => {
    const tiny = feed(startRecording('run', T0), fixesOf(0.05, 300));
    assert.equal(canSave(tiny, T0 + 30_000).ok, false);
    const real = feed(startRecording('run', T0), fixesOf(1, 300));
    assert.equal(canSave(real, T0 + 300_000).ok, true);
  });
});

describe('a recording through the real import', () => {
  it('keeps the recorder’s distance, excludes the pause from moving time, and stays a run', () => {
    const first = fixesOf(2, 300);
    let s = feed(startRecording('run', T0), first);
    const pausedAt = first[first.length - 1].t;
    s = pause(s, pausedAt);
    const resumedAt = pausedAt + 300_000;
    s = resume(s, resumedAt);
    s = feed(s, fixesOf(2, 300, resumedAt).map((f) => ({ ...f, lat: f.lat + 0.02 })));

    const parsed = decodeFile(new TextEncoder().encode(toTcx(s)));
    assert.equal(parsed.format, 'tcx');
    assert.equal(parsed.sport, 'run');
    const { draft } = buildActivity(parsed, 'x'.repeat(64), { athleteId: 'a', timeZone: 'Europe/Dublin', privacyTrimM: 200 });
    assert.ok(Math.abs(draft.distanceM - s.distanceM) < 5, `import ${draft.distanceM} vs recorder ${s.distanceM}`);
    assert.ok(Math.abs(draft.movingS - 1200) < 10, `moving ${draft.movingS}`);
    assert.ok(draft.elapsedS > 1450, 'elapsed includes the pause');
  });

  it('a ride is a ride', () => {
    const s = feed(startRecording('ride', T0), fixesOf(5, 120));
    assert.equal(decodeFile(new TextEncoder().encode(toTcx(s))).sport, 'ride');
  });
});
