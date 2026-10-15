import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gzipSync } from 'node:zlib';
import { analyse, computeSplits, cumulativeDistance, elevationChange, haversine, timeInZones, zonesFromHistogram } from './analyse.ts';
import { fitCrc, parseFit } from './fit.ts';
import { syntheticRun, toFit, toGpx, toTcx } from './fixtures.ts';
import { buildActivity, decodeFile, defaultName, fingerprint, hrHistogram } from './import.ts';
import { localDate, matchSession } from './match.ts';
import { decodePolyline, decodeRoute, encodePolyline, encodeRoute, privateSegments, projectRoute, simplify } from './route.ts';
import { ActivityFileError, type TrackPoint } from './types.ts';
import type { ScheduledWorkout } from '../domain/types.ts';

const enc = (s: string) => new TextEncoder().encode(s);
const RUN = syntheticRun({ start: '2026-10-10T07:00:00Z', distanceKm: 5, paceSecPerKm: 300 });

/* ---------------- FIT ---------------- */

describe('FIT decoding', () => {
  it('reads records, positions, altitude, heart rate and distance', () => {
    const parsed = parseFit(toFit(RUN));
    assert.equal(parsed.format, 'fit');
    assert.equal(parsed.points.length, RUN.length);
    const p = parsed.points[100];
    assert.ok(Math.abs((p.lat as number) - (RUN[100].lat as number)) < 1e-6, 'latitude survives semicircles');
    assert.ok(Math.abs((p.lon as number) - (RUN[100].lon as number)) < 1e-6, 'longitude survives semicircles');
    assert.ok(Math.abs((p.ele as number) - (RUN[100].ele as number)) < 0.21, 'altitude within the 0.2 m scale');
    assert.equal(p.hr, RUN[100].hr);
    assert.ok(Math.abs((p.dist as number) - (RUN[100].dist as number)) < 0.01);
    assert.equal(p.t, RUN[100].t);
  });

  it('takes sport and totals from the session message', () => {
    const parsed = parseFit(toFit(RUN, { sport: 1, subSport: 3 }));
    assert.equal(parsed.sport, 'trail_run');
    assert.equal(parsed.startedAt, '2026-10-10T07:00:00.000Z');
    assert.ok(parsed.device);
    assert.equal(parsed.device?.distanceM, 5000);
    assert.equal(parsed.device?.elapsedS, 1500);
  });

  it('maps cycling to a ride', () => {
    assert.equal(parseFit(toFit(RUN, { sport: 2 })).sport, 'ride');
  });

  it('resolves compressed-timestamp headers to the same times', () => {
    const parsed = parseFit(toFit(RUN, { compressed: true }));
    assert.equal(parsed.points.length, RUN.length);
    parsed.points.forEach((p, i) => assert.equal(p.t, RUN[i].t, `sample ${i}`));
  });

  it('accepts a zero CRC, which the protocol allows', () => {
    assert.equal(parseFit(toFit(RUN, { zeroCrc: true })).points.length, RUN.length);
  });

  it('rejects a file whose checksum does not match', () => {
    const bytes = toFit(RUN);
    bytes[200] ^= 0xff;
    assert.throws(() => parseFit(bytes), (e: unknown) => e instanceof ActivityFileError && /damaged/.test(e.message));
  });

  it('rejects a truncated file with a message about copying', () => {
    const bytes = toFit(RUN).slice(0, 4000);
    assert.throws(() => parseFit(bytes), /part-way/);
  });

  it('treats invalid sentinels as missing, not as zero', () => {
    const noGps: TrackPoint[] = RUN.slice(0, 50).map((p) => ({ ...p, lat: null, lon: null, hr: null }));
    const parsed = parseFit(toFit(noGps));
    assert.ok(parsed.points.every((p) => p.lat === null && p.lon === null && p.hr === null));
  });

  it('computes the CRC the SDK specifies', () => {
    // FIT's CRC is CRC-16/ARC; its standard check value over "123456789" is 0xBB3D
    assert.equal(fitCrc(new TextEncoder().encode('123456789')), 0xbb3d);
    assert.equal(fitCrc(new Uint8Array(0)), 0);
  });
});

/* ---------------- GPX / TCX ---------------- */

describe('GPX and TCX decoding', () => {
  it('reads a GPX track with Garmin heart-rate extensions', () => {
    const parsed = decodeFile(enc(toGpx(RUN, 'Riverside & back')));
    assert.equal(parsed.format, 'gpx');
    assert.equal(parsed.name, 'Riverside & back');
    assert.equal(parsed.sport, 'run');
    assert.equal(parsed.points.length, RUN.length);
    assert.equal(parsed.points[10].hr, RUN[10].hr);
  });

  it('reads a namespaced hr tag whatever the prefix', () => {
    const gpx = toGpx(RUN.slice(0, 3)).replace(/gpxtpx:/g, 'ns3:');
    assert.equal(decodeFile(enc(gpx)).points[0].hr, RUN[0].hr);
  });

  it('reads self-closing trackpoints with no body', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="52.1" lon="-8.6"/><trkpt lat="52.2" lon="-8.6"/></trkseg></trk></gpx>`;
    const parsed = decodeFile(enc(gpx));
    assert.equal(parsed.points.length, 2);
    assert.equal(parsed.points[1].lat, 52.2);
  });

  it('refuses a GPX route with no track', () => {
    const gpx = `<gpx><rte><rtept lat="52" lon="-8"/></rte></gpx>`;
    assert.throws(() => decodeFile(enc(gpx)), /no track/);
  });

  it('reads TCX with device distance', () => {
    const parsed = decodeFile(enc(toTcx(RUN.slice(0, 600))));
    assert.equal(parsed.format, 'tcx');
    assert.equal(parsed.points.length, 600);
    assert.equal(parsed.points[599].dist, RUN[599].dist);
  });

  it('does not expand entities or follow a DTD', () => {
    const bomb = `<?xml version="1.0"?><!DOCTYPE gpx [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">]>
      <gpx><trk><name>&b;</name><trkseg><trkpt lat="52" lon="-8"><time>2026-01-01T00:00:00Z</time></trkpt></trkseg></trk></gpx>`;
    const parsed = decodeFile(enc(bomb));
    assert.equal(parsed.name, '&b;');
  });

  it('stays linear on a file of unclosed trackpoints', () => {
    const hostile = '<gpx>' + '<trkpt lat="1" lon="1"><ele>1'.repeat(40000);
    const t = Date.now();
    decodeFile(enc(hostile));
    assert.ok(Date.now() - t < 3000, 'parsed in reasonable time');
  });
});

describe('format sniffing', () => {
  it('reads by content, not file name', () => {
    assert.equal(decodeFile(toFit(RUN)).format, 'fit');
    assert.equal(decodeFile(enc(toGpx(RUN))).format, 'gpx');
  });

  it('opens gzip, the way Strava bulk exports ship', () => {
    assert.equal(decodeFile(new Uint8Array(gzipSync(toFit(RUN)))).format, 'fit');
  });

  it('refuses anything else, and says what it wants', () => {
    assert.throws(() => decodeFile(enc('hello')), /\.fit, \.gpx or \.tcx/);
    assert.throws(() => decodeFile(new Uint8Array(0)), /empty/);
  });

  it('refuses a gzip that expands past the ceiling', () => {
    const bomb = gzipSync(Buffer.alloc(70 * 1024 * 1024));
    assert.throws(() => decodeFile(new Uint8Array(bomb)), /could not be opened/);
  });
});

/* ---------------- analysis ---------------- */

describe('distance', () => {
  it('haversine: one degree of latitude is ~111 km', () => {
    assert.ok(Math.abs(haversine(52, -8, 53, -8) - 111195) < 100);
  });

  it('prefers the device distance channel', () => {
    const c = cumulativeDistance(RUN);
    assert.equal(Math.round(c[c.length - 1]), 5000);
  });

  it('integrates GPS when the device has none, within 1%', () => {
    const gpsOnly = RUN.map((p) => ({ ...p, dist: null }));
    const c = cumulativeDistance(gpsOnly);
    assert.ok(Math.abs(c[c.length - 1] - 5000) < 50, `got ${c[c.length - 1]}`);
  });

  it('drops a GPS teleport instead of adding it', () => {
    const gpsOnly = RUN.map((p) => ({ ...p, dist: null }));
    gpsOnly[500] = { ...gpsOnly[500], lat: 53.5, lon: -6.2 }; // a fix in Dublin, one second later
    const c = cumulativeDistance(gpsOnly);
    assert.ok(c[c.length - 1] < 5200, `teleport added ${c[c.length - 1] - 5000} m`);
  });
});

describe('elevation', () => {
  it('ignores jitter inside the dead band', () => {
    const flat = RUN.map((p, i) => ({ ...p, ele: 20 + (i % 2 ? 1 : -1) }));
    assert.deepEqual(elevationChange(flat), { ascent: 0, descent: 0 });
  });

  it('counts real climbing', () => {
    const climb = RUN.map((p, i) => ({ ...p, ele: i * 0.05 }));
    const e = elevationChange(climb);
    assert.ok(e && Math.abs(e.ascent - RUN.length * 0.05) < 4);
  });
});

describe('splits', () => {
  it('cuts five even kilometres at the run’s pace', () => {
    const c = cumulativeDistance(RUN);
    const splits = computeSplits(RUN, c);
    assert.equal(splits.length, 5);
    for (const s of splits) {
      assert.equal(s.distanceM, 1000);
      assert.ok(Math.abs((s.paceSecPerKm as number) - 300) <= 1, `split ${s.index} pace ${s.paceSecPerKm}`);
      assert.ok(s.avgHr != null);
    }
  });

  it('keeps a partial final split and drops a trivial one', () => {
    const run = syntheticRun({ start: '2026-10-10T07:00:00Z', distanceKm: 5.5, paceSecPerKm: 300 });
    const splits = computeSplits(run, cumulativeDistance(run));
    assert.equal(splits.length, 6);
    assert.equal(splits[5].distanceM, 500);

    const nearly = syntheticRun({ start: '2026-10-10T07:00:00Z', distanceKm: 5.02, paceSecPerKm: 300 });
    assert.equal(computeSplits(nearly, cumulativeDistance(nearly)).length, 5);
  });

  it('mile splits for imperial athletes', () => {
    const a = analyse(RUN, null, 1609.344);
    assert.equal(a.splits.length, 4); // three full miles and a partial
    assert.equal(a.splits[0].distanceM, 1609);
  });
});

describe('analyse', () => {
  it('summarises a steady 5 km', () => {
    const a = analyse(RUN, null);
    assert.equal(a.distanceM, 5000);
    assert.ok(Math.abs(a.movingS - 1500) <= 2);
    assert.ok(Math.abs((a.avgPaceSecPerKm as number) - 300) <= 1);
    assert.ok(a.avgHr && a.avgHr > 140 && a.avgHr < 155);
    assert.ok(a.hasGps && a.hasHr);
    assert.ok(a.series.length > 100);
  });

  it('excludes a long stop from moving time but not elapsed', () => {
    const paused = RUN.map((p, i) => (i >= 600 ? { ...p, t: (p.t as number) + 300_000 } : p));
    const a = analyse(paused, null);
    assert.ok(Math.abs(a.movingS - 1500) <= 2, `moving ${a.movingS}`);
    assert.ok(Math.abs(a.elapsedS - 1800) <= 2, `elapsed ${a.elapsedS}`);
  });

  it('trusts the device summary when present', () => {
    const a = analyse(RUN, { distanceM: 5050, elapsedS: 1600, movingS: 1510, avgHr: 150, maxHr: 170, ascentM: 30 });
    assert.equal(a.distanceM, 5050);
    assert.equal(a.movingS, 1510);
    assert.equal(a.avgHr, 150);
    assert.equal(a.ascentM, 30);
  });
});

describe('heart-rate zones', () => {
  it('puts every second in exactly one zone', () => {
    const zones = timeInZones(RUN, 190);
    const total = zones.reduce((n, z) => n + z.seconds, 0);
    assert.ok(Math.abs(total - 1500) <= 2);
    // 142–154 bpm against 190 max is 75–81%: zone 3 with a little zone 4
    assert.ok(zones[2].seconds > zones[3].seconds);
  });

  it('re-cuts the same as live when built from the stored histogram', () => {
    const live = timeInZones(RUN, 185).map((z) => z.seconds);
    const stored = zonesFromHistogram(hrHistogram(RUN), 185).map((z) => z.seconds);
    live.forEach((s, i) => assert.ok(Math.abs(s - stored[i]) <= 3, `zone ${i + 1}: ${s} vs ${stored[i]}`));
  });
});

/* ---------------- route + privacy ---------------- */

describe('route privacy', () => {
  const c = cumulativeDistance(RUN);

  it('hides the first and last stretch', () => {
    const [seg] = privateSegments(RUN, c, 500);
    const start = RUN[0];
    const nearest = Math.min(...seg.map(([la, lo]) => haversine(start.lat as number, start.lon as number, la, lo)));
    // on a loop the hidden ends meet at the door; nothing visible comes within ~150 m of it
    assert.ok(nearest > 150, `closest visible point ${nearest.toFixed(0)} m from the door`);
  });

  it('cuts a zone out as a gap, never as a bridge', () => {
    const mid = RUN[750];
    const segs = privateSegments(RUN, c, 0, [{ lat: mid.lat as number, lon: mid.lon as number, radiusM: 100 }]);
    assert.equal(segs.length, 2);
    for (const seg of segs) {
      for (const [la, lo] of seg) assert.ok(haversine(mid.lat as number, mid.lon as number, la, lo) > 100);
    }
  });

  it('shows nothing of a run shorter than both trims', () => {
    const short = syntheticRun({ start: '2026-10-10T07:00:00Z', distanceKm: 0.3, paceSecPerKm: 300 });
    assert.deepEqual(privateSegments(short, cumulativeDistance(short), 200), []);
  });

  it('a trim of zero keeps the whole line', () => {
    const [seg] = privateSegments(RUN, c, 0);
    assert.equal(seg.length, RUN.length);
  });
});

describe('polyline', () => {
  it('round-trips at five decimal places', () => {
    const line: [number, number][] = [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]];
    assert.equal(encodePolyline(line), '_p~iF~ps|U_ulLnnqC_mqNvxq`@'); // the format's published example
    assert.deepEqual(decodePolyline(encodePolyline(line)), line);
  });

  it('simplifies a straight line to its ends', () => {
    const line: [number, number][] = Array.from({ length: 50 }, (_, i) => [52 + i * 0.0001, -8]);
    assert.equal(simplify(line).length, 2);
  });

  it('keeps a corner', () => {
    const line: [number, number][] = [[52, -8], [52.001, -8], [52.002, -8], [52.002, -7.998], [52.002, -7.996]];
    assert.ok(simplify(line).some(([a, b]) => a === 52.002 && b === -8));
  });

  it('keeps segments apart even when a polyline contains a pipe', () => {
    const a: [number, number][] = [[38.5, -120.2], [40.7, -120.95]];
    const b: [number, number][] = [[43.252, -126.453], [43.3, -126.4]];
    assert.ok(encodePolyline(a).includes('|'));
    assert.deepEqual(decodeRoute(encodeRoute([a, b])), [a, b]);
  });

  it('projects into the viewBox with the route’s true aspect', () => {
    const { paths, start, end } = projectRoute(decodeRoute('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), 400, 300);
    assert.equal(paths.length, 1);
    assert.ok(start && end);
    for (const [x, y] of [start, end] as [number, number][]) {
      assert.ok(x >= 0 && x <= 400 && y >= 0 && y <= 300);
    }
  });
});

/* ---------------- building the record ---------------- */

describe('buildActivity', () => {
  const bytes = toFit(RUN);
  const parsed = decodeFile(bytes);

  it('stores numbers and a trimmed route, never the raw track', () => {
    const { draft } = buildActivity(parsed, fingerprint(bytes), {
      athleteId: 'a1',
      timeZone: 'Europe/Dublin',
      privacyTrimM: 200,
    });
    assert.equal(draft.distanceM, 5000);
    assert.equal(draft.localDate, '2026-10-10');
    assert.equal(draft.name, 'Morning run');
    assert.ok(draft.route);
    const pts = decodeRoute(draft.route).flat();
    assert.ok(pts.length < RUN.length / 2, 'simplified');
    assert.ok(!('points' in draft));
    assert.equal(draft.fingerprint.length, 64);
  });

  it('dates by the athlete’s calendar, not the server’s', () => {
    const late = syntheticRun({ start: '2026-10-10T23:30:00Z', distanceKm: 3, paceSecPerKm: 300 });
    const p = decodeFile(toFit(late));
    // 23:30 UTC is 00:30 the next day in Dublin summer time
    assert.equal(buildActivity(p, 'x', { athleteId: 'a', timeZone: 'Europe/Dublin', privacyTrimM: 0 }).draft.localDate, '2026-10-11');
    assert.equal(buildActivity(p, 'x', { athleteId: 'a', timeZone: 'UTC', privacyTrimM: 0 }).draft.localDate, '2026-10-10');
  });

  it('the same bytes always fingerprint the same', () => {
    assert.equal(fingerprint(toFit(RUN)), fingerprint(toFit(RUN)));
    assert.notEqual(fingerprint(toFit(RUN)), fingerprint(toFit(RUN, { compressed: true })));
  });

  it('refuses a file with no timestamps', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="52.1" lon="-8.6"/><trkpt lat="52.2" lon="-8.6"/></trkseg></trk></gpx>`;
    assert.throws(
      () => buildActivity(decodeFile(enc(gpx)), 'x', { athleteId: 'a', timeZone: 'UTC', privacyTrimM: 0 }),
      /no timestamps/,
    );
  });

  it('names by time of day in the athlete’s zone', () => {
    assert.equal(defaultName('run', '2026-10-10T18:00:00Z', 'Europe/Dublin'), 'Evening run');
    assert.equal(defaultName('ride', '2026-10-10T06:00:00Z', 'Europe/Dublin'), 'Morning ride');
  });
});

/* ---------------- matching ---------------- */

function session(id: string, date: string, type: ScheduledWorkout['type'], status: ScheduledWorkout['status'] = 'scheduled') {
  return { id, date, type, status } as ScheduledWorkout;
}

describe('matching to the plan', () => {
  it('matches the one session that fits', () => {
    const r = matchSession([session('s1', '2026-10-10', 'easy_run'), session('s2', '2026-10-10', 'strength')], '2026-10-10', 'run');
    assert.deepEqual(r, { kind: 'matched', scheduledId: 's1' });
  });

  it('asks when two could fit', () => {
    const r = matchSession([session('s1', '2026-10-10', 'easy_run'), session('s2', '2026-10-10', 'tempo')], '2026-10-10', 'run');
    assert.equal(r.kind, 'ambiguous');
  });

  it('never matches a run to a ride, or to another day', () => {
    assert.equal(matchSession([session('s1', '2026-10-10', 'bike')], '2026-10-10', 'run').kind, 'none');
    assert.equal(matchSession([session('s1', '2026-10-11', 'easy_run')], '2026-10-10', 'run').kind, 'none');
  });

  it('enriches a session already logged by hand rather than completing another', () => {
    const r = matchSession([session('s1', '2026-10-10', 'long_run', 'completed')], '2026-10-10', 'run');
    assert.deepEqual(r, { kind: 'logged', scheduledId: 's1' });
  });

  it('a rest day has nothing to match', () => {
    const r = matchSession([session('s1', '2026-10-10', 'rest')], '2026-10-10', 'run');
    assert.deepEqual(r, { kind: 'none', reason: 'Nothing was prescribed that day.' });
  });

  it('survives an unknown time zone name', () => {
    assert.equal(localDate('2026-10-10T12:00:00Z', 'Not/AZone'), '2026-10-10');
  });
});

describe('hostile files cost little', () => {
  it('a FIT of field-less records — 57 KB gzipped, 59M "points" — is refused, not parsed', () => {
    const n = 59_000_000;
    const body = 6 + n;
    const b = new Uint8Array(14 + body + 2);
    b[0] = 14;
    b[1] = 0x10;
    new DataView(b.buffer).setUint32(4, body, true);
    b.set([0x2e, 0x46, 0x49, 0x54], 8);
    b.set([0x40, 0, 0, 20, 0, 0], 14); // definition: record (20), no fields; every byte after is a record
    const gz = gzipSync(b, { level: 9 });
    assert.ok(gz.length < 100_000);
    const started = Date.now();
    assert.throws(() => decodeFile(new Uint8Array(gz)), ActivityFileError);
    assert.ok(Date.now() - started < 5000);
  });

  it('a track with more points than any real activity is refused', () => {
    const pt = '<trkpt lat="52.66" lon="-8.63"/>';
    const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>${pt.repeat(200_001)}</trkseg></trk></gpx>`;
    assert.throws(() => decodeFile(new TextEncoder().encode(gpx)), /more track points/);
  });

  it('a TCX position off the globe is no position, so it cannot poison the stored route', () => {
    const run = syntheticRun({ start: '2026-10-10T07:00:00Z', distanceKm: 3, paceSecPerKm: 300, intervalS: 2 });
    const tcx = toTcx(run).replace(/<LatitudeDegrees>[^<]*</g, '<LatitudeDegrees>99999<');
    const parsed = decodeFile(new TextEncoder().encode(tcx));
    assert.ok(parsed.points.every((p) => p.lat == null && p.lon == null));
  });

  it('a damaged stored route renders as nothing rather than throwing', () => {
    const good = encodePolyline([[52.66, -8.63], [52.67, -8.62]]);
    assert.deepEqual(decodeRoute(`${good};_`).length, 1);
  });
});

describe('privacy trim hides places, not only distances', () => {
  it('three laps from the front door never show the door, even mid-route', () => {
    // a 1.5 km out-and-back from the door, three times
    const door: [number, number] = [52.66, -8.63];
    const points: TrackPoint[] = [];
    for (let lap = 0; lap < 3; lap++) {
      for (let k = 0; k <= 150; k++) {
        const f = k <= 75 ? k / 75 : (150 - k) / 75;
        points.push({ t: Date.UTC(2026, 9, 10, 7) + (lap * 151 + k) * 3000, lat: door[0] + f * 0.00675, lon: door[1], ele: null, hr: null, cad: null, dist: null });
      }
    }
    const cumulative = cumulativeDistance(points);
    const shown = privateSegments(points, cumulative, 200).flat();
    assert.ok(shown.length > 0);
    assert.ok(shown.every(([lat, lon]) => haversine(door[0], door[1], lat, lon) > 200), 'nothing within 200 m of the door');
  });
});
