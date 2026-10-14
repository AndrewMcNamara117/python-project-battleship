import { ActivityFileError, type ActivitySport, type DeviceSummary, type ParsedActivity, type TrackPoint } from './types';

/**
 * A FIT decoder, reduced to what a training log needs.
 *
 * FIT is Garmin's published binary format (the FIT SDK protocol, now an open
 * standard) and what nearly every watch writes natively. A file is a header, a
 * stream of records, and a CRC. Records are either *definitions* — "local
 * message 3 is a `record` with these fields, these sizes, this byte order" —
 * or *data* laid out by the most recent definition for that local number.
 *
 * Only three global messages matter here: `record` (the per-second samples),
 * `session` (the device's own totals) and `sport`. Everything else is read
 * past by its declared size, so unknown or developer fields can never desync
 * the stream.
 */

/** Seconds between the Unix epoch and the FIT epoch, 1989-12-31T00:00:00Z. */
const FIT_EPOCH_S = 631065600;
const SEMICIRCLE_TO_DEG = 180 / 2 ** 31;

const MSG_SESSION = 18;
const MSG_RECORD = 20;
const MSG_SPORT = 12;

interface FieldDef {
  num: number;
  size: number;
  baseType: number;
}

interface Definition {
  global: number;
  littleEndian: boolean;
  fields: FieldDef[];
  devBytes: number;
  /** Bytes in one data record of this definition, header excluded. */
  length: number;
}

/** FIT's CRC-16, nibble-table form, exactly as the SDK specifies it. */
const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

export function fitCrc(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    const b = bytes[i];
    let tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[b & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(b >> 4) & 0xf];
  }
  return crc;
}

export function looksLikeFit(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    (bytes[0] === 12 || bytes[0] === 14) &&
    bytes[8] === 0x2e && bytes[9] === 0x46 && bytes[10] === 0x49 && bytes[11] === 0x54 // ".FIT"
  );
}

/**
 * Read one scalar of a base type. Returns null for the type's "invalid"
 * sentinel, which is how FIT says "no reading" (a dropped HR strap, no GPS).
 */
function readValue(view: DataView, offset: number, def: FieldDef, le: boolean): number | null {
  const bt = def.baseType & 0x1f;
  switch (bt) {
    case 0x00: // enum
    case 0x02: // uint8
    case 0x0a: { // uint8z
      if (def.size < 1) return null;
      const v = view.getUint8(offset);
      return v === 0xff || (bt === 0x0a && v === 0) ? null : v;
    }
    case 0x01: { // sint8
      if (def.size < 1) return null;
      const v = view.getInt8(offset);
      return v === 0x7f ? null : v;
    }
    case 0x03: { // sint16
      if (def.size < 2) return null;
      const v = view.getInt16(offset, le);
      return v === 0x7fff ? null : v;
    }
    case 0x04: // uint16
    case 0x0b: { // uint16z
      if (def.size < 2) return null;
      const v = view.getUint16(offset, le);
      return v === 0xffff || (bt === 0x0b && v === 0) ? null : v;
    }
    case 0x05: { // sint32
      if (def.size < 4) return null;
      const v = view.getInt32(offset, le);
      return v === 0x7fffffff ? null : v;
    }
    case 0x06: // uint32
    case 0x0c: { // uint32z
      if (def.size < 4) return null;
      const v = view.getUint32(offset, le);
      return v === 0xffffffff || (bt === 0x0c && v === 0) ? null : v;
    }
    case 0x08: { // float32
      if (def.size < 4) return null;
      const v = view.getFloat32(offset, le);
      return Number.isFinite(v) ? v : null;
    }
    case 0x09: { // float64
      if (def.size < 8) return null;
      const v = view.getFloat64(offset, le);
      return Number.isFinite(v) ? v : null;
    }
    default:
      // strings, bytes and 64-bit integers: nothing here reads them
      return null;
  }
}

function sportFrom(sport: number | null, subSport: number | null): ActivitySport {
  // FIT profile `sport` enum: 1 running, 2 cycling, 5 swimming, 11 walking, 17 hiking
  if (sport === 1) return subSport === 3 ? 'trail_run' : 'run';
  if (sport === 2) return 'ride';
  if (sport === 5) return 'swim';
  if (sport === 11) return 'walk';
  if (sport === 17) return 'hike';
  return 'other';
}

export function parseFit(bytes: Uint8Array): ParsedActivity {
  if (!looksLikeFit(bytes)) throw new ActivityFileError('That is not a FIT file.');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = bytes[0];
  const dataSize = view.getUint32(4, true);
  const dataEnd = headerSize + dataSize;
  if (dataEnd + 2 > bytes.length) {
    throw new ActivityFileError('The file stops part-way through. It may not have finished copying off the watch.');
  }

  // A stored CRC of zero means the writer did not compute one, which the
  // protocol allows. Anything else must match, or the bytes cannot be trusted.
  const storedCrc = view.getUint16(dataEnd, true);
  if (storedCrc !== 0 && storedCrc !== fitCrc(bytes, 0, dataEnd)) {
    throw new ActivityFileError('The file is damaged — its checksum does not match. Export it from the watch again.');
  }

  const defs = new Map<number, Definition>();
  const points: TrackPoint[] = [];
  let lastTimestamp: number | null = null;
  let sport: number | null = null;
  let subSport: number | null = null;
  let startS: number | null = null;
  let device: DeviceSummary | null = null;

  let pos = headerSize;
  while (pos < dataEnd) {
    const header = bytes[pos++];
    let local: number;
    let timeOffset: number | null = null;

    if (header & 0x80) {
      // compressed timestamp header: a data record carrying a 5-bit time delta
      local = (header >> 5) & 0x03;
      timeOffset = header & 0x1f;
    } else {
      local = header & 0x0f;
      if (header & 0x40) {
        // definition message
        if (pos + 5 > dataEnd) break;
        const littleEndian = bytes[pos + 1] === 0;
        const global = view.getUint16(pos + 2, littleEndian);
        const count = bytes[pos + 4];
        pos += 5;
        const fields: FieldDef[] = [];
        let length = 0;
        for (let i = 0; i < count; i++) {
          if (pos + 3 > dataEnd) throw new ActivityFileError('The file is malformed.');
          const f = { num: bytes[pos], size: bytes[pos + 1], baseType: bytes[pos + 2] };
          fields.push(f);
          length += f.size;
          pos += 3;
        }
        let devBytes = 0;
        if (header & 0x20) {
          const devCount = bytes[pos++];
          for (let i = 0; i < devCount; i++) {
            devBytes += bytes[pos + 1];
            pos += 3;
          }
        }
        defs.set(local, { global, littleEndian, fields, devBytes, length: length + devBytes });
        continue;
      }
    }

    const def = defs.get(local);
    if (!def) throw new ActivityFileError('The file is malformed: a record arrived before its definition.');
    if (pos + def.length > dataEnd) throw new ActivityFileError('The file stops part-way through a record.');

    const values = new Map<number, number | null>();
    let offset = pos;
    for (const f of def.fields) {
      values.set(f.num, readValue(view, offset, f, def.littleEndian));
      offset += f.size;
    }
    pos += def.length;

    // field 253 is the timestamp on every message that has one
    let ts = values.get(253) ?? null;
    if (ts != null) {
      lastTimestamp = ts;
    } else if (timeOffset != null && lastTimestamp != null) {
      // the rollover rule from the protocol: offsets are relative to the low 5 bits
      ts = (lastTimestamp & ~0x1f) + timeOffset + (timeOffset < (lastTimestamp & 0x1f) ? 0x20 : 0);
      lastTimestamp = ts;
    }

    if (def.global === MSG_RECORD) {
      const lat = values.get(0) ?? null;
      const lon = values.get(1) ?? null;
      const enhancedAlt = values.get(78) ?? null;
      const alt = values.get(2) ?? null;
      const altitude = enhancedAlt != null ? enhancedAlt / 5 - 500 : alt != null ? alt / 5 - 500 : null;
      const dist = values.get(5) ?? null;
      points.push({
        t: ts != null ? (ts + FIT_EPOCH_S) * 1000 : null,
        lat: lat != null && lon != null ? lat * SEMICIRCLE_TO_DEG : null,
        lon: lat != null && lon != null ? lon * SEMICIRCLE_TO_DEG : null,
        ele: altitude,
        hr: values.get(3) ?? null,
        cad: values.get(4) ?? null,
        dist: dist != null ? dist / 100 : null,
      });
    } else if (def.global === MSG_SESSION) {
      sport = values.get(5) ?? sport;
      subSport = values.get(6) ?? subSport;
      startS = values.get(2) ?? startS;
      const elapsed = values.get(7) ?? null;
      const timer = values.get(8) ?? null;
      const distance = values.get(9) ?? null;
      device = {
        distanceM: distance != null ? distance / 100 : null,
        elapsedS: elapsed != null ? elapsed / 1000 : null,
        movingS: timer != null ? timer / 1000 : null,
        avgHr: values.get(16) ?? null,
        maxHr: values.get(17) ?? null,
        ascentM: values.get(22) ?? null,
      };
    } else if (def.global === MSG_SPORT) {
      sport = values.get(0) ?? sport;
      subSport = values.get(1) ?? subSport;
    }
  }

  if (!points.length && !device) {
    throw new ActivityFileError('That FIT file has no activity in it. Settings and course files cannot be imported.');
  }

  const first = points.find((p) => p.t != null)?.t ?? null;
  const startedAt =
    startS != null ? new Date((startS + FIT_EPOCH_S) * 1000).toISOString() : first != null ? new Date(first).toISOString() : null;

  return { format: 'fit', sport: sportFrom(sport, subSport), name: null, startedAt, points, device };
}
