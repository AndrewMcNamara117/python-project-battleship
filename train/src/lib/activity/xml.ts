import { ActivityFileError, type ActivitySport, type ParsedActivity, type TrackPoint } from './types';

/**
 * GPX and TCX, read as text.
 *
 * Both are flat enough that a scanner over the raw XML is more robust than a
 * DOM: there is no DOMParser on the server, and an XML library would mean
 * entity expansion — the classic way a small file becomes a very large one.
 * Nothing here expands an entity or follows a DTD. Namespace prefixes vary by
 * exporter (`gpxtpx:hr`, `ns3:hr`, bare `hr`), so tags are matched with an
 * optional prefix.
 */

const num = (s: string | undefined | null): number | null => {
  if (s == null) return null;
  const v = Number.parseFloat(s.trim());
  return Number.isFinite(v) ? v : null;
};

/** Inner text of the first `<prefix:tag>` in a fragment. */
function tag(fragment: string, name: string): string | null {
  const m = new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, 'i').exec(fragment);
  return m ? m[1] : null;
}

function attr(openTag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(openTag);
  return m ? m[1] : null;
}

function time(s: string | null): number | null {
  if (!s) return null;
  const v = Date.parse(s.trim());
  return Number.isFinite(v) ? v : null;
}

function decode(s: string | null): string | null {
  if (!s) return null;
  const text = s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
  return text ? text.slice(0, 120) : null;
}

function sportFromText(s: string | null): ActivitySport {
  const v = (s ?? '').toLowerCase();
  if (/trail/.test(v)) return 'trail_run';
  if (/run/.test(v)) return 'run';
  if (/hik/.test(v)) return 'hike';
  if (/walk/.test(v)) return 'walk';
  if (/bik|cycl|ride/.test(v)) return 'ride';
  if (/swim/.test(v)) return 'swim';
  // GPX from most watches carries no type; a training log is mostly running
  return v ? 'other' : 'run';
}

/**
 * Every `<name …>…</name>` element, by splitting rather than matching.
 *
 * A lazy regex over the whole document is quadratic on a file whose elements
 * never close; splitting is linear whatever the input. Each chunk runs from
 * just after the tag name to its closing tag (or the next opening one).
 */
function* elements(text: string, name: string): Generator<string> {
  const parts = text.split(new RegExp(`<(?:[\\w-]+:)?${name}(?=[\\s>/])`, 'i'));
  const closing = new RegExp(`</(?:[\\w-]+:)?${name}>`, 'i');
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const end = part.search(closing);
    yield end >= 0 ? part.slice(0, end) : part;
  }
}

export function looksLikeGpx(text: string): boolean {
  return /<gpx[\s>]/i.test(text.slice(0, 4000));
}

export function looksLikeTcx(text: string): boolean {
  return /<TrainingCenterDatabase[\s>]/i.test(text.slice(0, 4000));
}

export function parseGpx(text: string): ParsedActivity {
  if (!looksLikeGpx(text)) throw new ActivityFileError('That is not a GPX file.');

  const trk = tag(text, 'trk');
  const name = decode(trk ? tag(trk.replace(/<trkseg[\s\S]*/i, ''), 'name') : tag(text, 'name'));
  const type = trk ? tag(trk.replace(/<trkseg[\s\S]*/i, ''), 'type') : null;

  const points: TrackPoint[] = [];
  for (const chunk of elements(text, 'trkpt')) {
    const close = chunk.indexOf('>');
    if (close < 0) continue;
    const open = chunk.slice(0, close);
    const body = open.endsWith('/') ? '' : chunk.slice(close + 1);
    const lat = num(attr(open, 'lat'));
    const lon = num(attr(open, 'lon'));
    const valid = lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    points.push({
      t: time(tag(body, 'time')),
      lat: valid ? lat : null,
      lon: valid ? lon : null,
      ele: num(tag(body, 'ele')),
      hr: num(tag(body, 'hr')),
      cad: num(tag(body, 'cad')),
      dist: null,
    });
  }

  if (!points.length) {
    throw new ActivityFileError('That GPX file has no track in it. A planned route cannot be imported as a run.');
  }

  const first = points.find((p) => p.t != null)?.t ?? null;
  return {
    format: 'gpx',
    sport: sportFromText(type),
    name,
    startedAt: first != null ? new Date(first).toISOString() : null,
    points,
    device: null,
  };
}

export function parseTcx(text: string): ParsedActivity {
  if (!looksLikeTcx(text)) throw new ActivityFileError('That is not a TCX file.');

  const activity = /<Activity\b([^>]*)>/i.exec(text);
  const sport = sportFromText(activity ? attr(activity[1], 'Sport') : null);
  const id = tag(text, 'Id');

  const points: TrackPoint[] = [];
  for (const chunk of elements(text, 'Trackpoint')) {
    const body = chunk.slice(chunk.indexOf('>') + 1);
    const position = tag(body, 'Position');
    const lat = position ? num(tag(position, 'LatitudeDegrees')) : null;
    const lon = position ? num(tag(position, 'LongitudeDegrees')) : null;
    const hrBlock = tag(body, 'HeartRateBpm');
    points.push({
      t: time(tag(body, 'Time')),
      lat: lat != null && lon != null ? lat : null,
      lon: lat != null && lon != null ? lon : null,
      ele: num(tag(body, 'AltitudeMeters')),
      hr: hrBlock ? num(tag(hrBlock, 'Value')) : null,
      cad: num(tag(body, 'Cadence')) ?? num(tag(body, 'RunCadence')),
      dist: num(tag(body, 'DistanceMeters')),
    });
  }

  if (!points.length) throw new ActivityFileError('That TCX file has no trackpoints in it.');

  const first = points.find((p) => p.t != null)?.t ?? time(id);
  return {
    format: 'tcx',
    sport,
    name: null,
    startedAt: first != null ? new Date(first).toISOString() : null,
    points,
    device: null,
  };
}
