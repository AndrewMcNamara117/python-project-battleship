import { fitCrc } from './fit';
import type { TrackPoint } from './types';

/**
 * Synthetic activities, written in the real formats.
 *
 * Tests feed these through the same decoders an upload goes through, so the
 * parsers are proven against actual FIT bytes and actual GPX text rather than
 * against objects shaped like what a parser would return. The demo also uses
 * them: there is a sample file to try the importer with before anyone owns a
 * watch export.
 */

const FIT_EPOCH_S = 631065600;
const DEG_TO_SEMICIRCLE = 2 ** 31 / 180;

export interface SyntheticRunOptions {
  /** ISO start time. */
  start: string;
  distanceKm: number;
  paceSecPerKm: number;
  /** Seconds between samples. */
  intervalS?: number;
  /** Where the loop is centred. Defaults to the University of Limerick riverside. */
  centre?: [number, number];
  baseHr?: number;
  /** Peak-to-trough of the rolling terrain, metres. */
  hillM?: number;
}

/**
 * A loop run at even pace with a gentle heart-rate drift and rolling terrain.
 * Deterministic: the same options give the same points.
 */
export function syntheticRun(opts: SyntheticRunOptions): TrackPoint[] {
  const interval = opts.intervalS ?? 1;
  const [cLat, cLon] = opts.centre ?? [52.6735, -8.5713];
  const totalM = opts.distanceKm * 1000;
  const speed = 1000 / opts.paceSecPerKm;
  const samples = Math.ceil(totalM / speed / interval);
  // a circle whose circumference is the whole run, so it starts and ends at the same door
  const radiusM = totalM / (2 * Math.PI);
  const mPerDegLat = 110540;
  const mPerDegLon = 111320 * Math.cos((cLat * Math.PI) / 180);
  const t0 = Date.parse(opts.start);
  const baseHr = opts.baseHr ?? 142;
  const hill = opts.hillM ?? 12;

  const out: TrackPoint[] = [];
  for (let i = 0; i <= samples; i++) {
    const d = Math.min(totalM, i * interval * speed);
    const theta = (d / totalM) * 2 * Math.PI;
    out.push({
      t: t0 + i * interval * 1000,
      lat: cLat + (radiusM * Math.sin(theta)) / mPerDegLat,
      lon: cLon + (radiusM * (1 - Math.cos(theta))) / mPerDegLon,
      ele: 20 + (hill / 2) * Math.sin((d / 1000) * Math.PI),
      hr: Math.round(baseHr + 10 * (d / totalM) + 2 * Math.sin(i / 17)),
      cad: 172,
      dist: d,
    });
  }
  return out;
}

export function toGpx(points: TrackPoint[], name = 'Synthetic run', type = 'running'): string {
  const pts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat?.toFixed(7)}" lon="${p.lon?.toFixed(7)}">` +
        (p.ele != null ? `<ele>${p.ele.toFixed(1)}</ele>` : '') +
        (p.t != null ? `<time>${new Date(p.t).toISOString()}</time>` : '') +
        (p.hr != null
          ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.hr}</gpxtpx:hr><gpxtpx:cad>${p.cad ?? 0}</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions>`
          : '') +
        `</trkpt>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Iron Miles" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <name>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</name>
    <type>${type}</type>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}

export function toTcx(points: TrackPoint[], sport = 'Running'): string {
  const pts = points
    .map(
      (p) =>
        `<Trackpoint><Time>${new Date(p.t as number).toISOString()}</Time>` +
        `<Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lon}</LongitudeDegrees></Position>` +
        `<AltitudeMeters>${p.ele}</AltitudeMeters><DistanceMeters>${p.dist}</DistanceMeters>` +
        `<HeartRateBpm><Value>${p.hr}</Value></HeartRateBpm></Trackpoint>`,
    )
    .join('');
  return `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="${sport}"><Id>${new Date(points[0].t as number).toISOString()}</Id><Lap><Track>${pts}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
}

/* ---------------- FIT ---------------- */

class Bytes {
  private parts: number[] = [];
  u8(v: number) { this.parts.push(v & 0xff); return this; }
  u16(v: number) { return this.u8(v).u8(v >> 8); }
  u32(v: number) { return this.u16(v & 0xffff).u16((v >>> 16) & 0xffff); }
  i32(v: number) { return this.u32(v >>> 0); }
  get length() { return this.parts.length; }
  toArray() { return Uint8Array.from(this.parts); }
}

export interface FitOptions {
  /** FIT `sport` enum. 1 running, 2 cycling. */
  sport?: number;
  subSport?: number;
  /** Write a session message with device totals. */
  session?: boolean;
  /** Emit every other record with a compressed-timestamp header. */
  compressed?: boolean;
  /** Write a zero CRC, which the protocol allows. */
  zeroCrc?: boolean;
}

/**
 * A minimal but valid FIT activity: file_id, records, and optionally a session.
 * Little-endian throughout, as every watch writes.
 */
export function toFit(points: TrackPoint[], opts: FitOptions = {}): Uint8Array {
  const body = new Bytes();
  const ts = (ms: number) => Math.round(ms / 1000) - FIT_EPOCH_S;

  // definition: local 0 = file_id (global 0): type(0) enum, manufacturer(1) uint16, time_created(4) uint32
  body.u8(0x40).u8(0).u8(0).u16(0).u8(3);
  body.u8(0).u8(1).u8(0x00);
  body.u8(1).u8(2).u8(0x84);
  body.u8(4).u8(4).u8(0x86);
  body.u8(0x00).u8(4).u16(1).u32(ts(points[0].t as number)); // type activity, manufacturer garmin

  // definition: local 1 = record (global 20)
  const recordFields: [number, number, number][] = [
    [253, 4, 0x86], // timestamp
    [0, 4, 0x85], // position_lat
    [1, 4, 0x85], // position_long
    [78, 4, 0x86], // enhanced_altitude
    [3, 1, 0x02], // heart_rate
    [4, 1, 0x02], // cadence
    [5, 4, 0x86], // distance
  ];
  body.u8(0x41).u8(0).u8(0).u16(20).u8(recordFields.length);
  for (const [n, s, b] of recordFields) body.u8(n).u8(s).u8(b);

  // definition: local 2 = record without its timestamp field, for compressed headers
  if (opts.compressed) {
    const fields = recordFields.slice(1);
    body.u8(0x42).u8(0).u8(0).u16(20).u8(fields.length);
    for (const [n, s, b] of fields) body.u8(n).u8(s).u8(b);
  }

  points.forEach((p, i) => {
    const useCompressed = opts.compressed && i % 2 === 1;
    if (useCompressed) {
      // bit 7 set, local message 2 in bits 5-6, low five bits of the timestamp
      body.u8(0x80 | (2 << 5) | (ts(p.t as number) & 0x1f));
    } else {
      body.u8(0x01).u32(ts(p.t as number));
    }
    body
      .i32(p.lat != null ? Math.round(p.lat * DEG_TO_SEMICIRCLE) : 0x7fffffff)
      .i32(p.lon != null ? Math.round(p.lon * DEG_TO_SEMICIRCLE) : 0x7fffffff)
      .u32(p.ele != null ? Math.round((p.ele + 500) * 5) : 0xffffffff)
      .u8(p.hr ?? 0xff)
      .u8(p.cad ?? 0xff)
      .u32(p.dist != null ? Math.round(p.dist * 100) : 0xffffffff);
  });

  if (opts.session !== false) {
    // definition: local 3 = session (global 18)
    const fields: [number, number, number][] = [
      [253, 4, 0x86], [2, 4, 0x86], [5, 1, 0x00], [6, 1, 0x00], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86],
      [16, 1, 0x02], [17, 1, 0x02],
    ];
    body.u8(0x43).u8(0).u8(0).u16(18).u8(fields.length);
    for (const [n, s, b] of fields) body.u8(n).u8(s).u8(b);
    const first = points[0];
    const last = points[points.length - 1];
    const hrs = points.map((p) => p.hr).filter((h): h is number => h != null);
    const elapsedMs = (last.t as number) - (first.t as number);
    body
      .u8(0x03)
      .u32(ts(last.t as number))
      .u32(ts(first.t as number))
      .u8(opts.sport ?? 1)
      .u8(opts.subSport ?? 0)
      .u32(elapsedMs)
      .u32(elapsedMs)
      .u32(Math.round((last.dist ?? 0) * 100))
      .u8(hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0xff)
      .u8(hrs.length ? Math.max(...hrs) : 0xff);
  }

  const data = body.toArray();
  const header = new Bytes().u8(14).u8(0x20).u16(2132).u32(data.length);
  for (const c of '.FIT') header.u8(c.charCodeAt(0));
  const head12 = header.toArray();
  const headerCrc = fitCrc(head12);
  const file = new Uint8Array(14 + data.length + 2);
  file.set(head12, 0);
  file[12] = headerCrc & 0xff;
  file[13] = headerCrc >> 8;
  file.set(data, 14);
  const crc = opts.zeroCrc ? 0 : fitCrc(file, 0, 14 + data.length);
  file[14 + data.length] = crc & 0xff;
  file[15 + data.length] = crc >> 8;
  return file;
}
