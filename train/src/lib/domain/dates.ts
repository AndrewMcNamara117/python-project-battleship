import type { ISODate } from './types';

const DAY_MS = 86_400_000;

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_FULL = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** Calendar-day string in UTC. Training days are dates, not instants. */
export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function fromISODate(s: ISODate): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function addDays(s: ISODate, n: number): ISODate {
  return toISODate(new Date(fromISODate(s).getTime() + n * DAY_MS));
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / DAY_MS);
}

/** ISO weekday index, Monday = 0. */
export function weekdayIndex(s: ISODate): number {
  return (fromISODate(s).getUTCDay() + 6) % 7;
}

/** Monday of the week containing `s`. */
export function startOfWeek(s: ISODate): ISODate {
  return addDays(s, -weekdayIndex(s));
}

export function endOfWeek(s: ISODate): ISODate {
  return addDays(startOfWeek(s), 6);
}

export function startOfMonth(s: ISODate): ISODate {
  return `${s.slice(0, 7)}-01`;
}

export function weekDates(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** The 6x7 grid a month view needs, padded into neighbouring months. */
export function monthGrid(anchor: ISODate): ISODate[] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function formatDate(s: ISODate, opts: Intl.DateTimeFormatOptions = {}): string {
  return fromISODate(s).toLocaleDateString('en-IE', { timeZone: 'UTC', ...opts });
}

export function formatDayMonth(s: ISODate): string {
  return formatDate(s, { day: 'numeric', month: 'short' });
}

export function formatLongDate(s: ISODate): string {
  return formatDate(s, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function monthLabel(s: ISODate): string {
  return formatDate(s, { month: 'long', year: 'numeric' });
}

export function isSameMonth(a: ISODate, b: ISODate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/* ---------- durations and paces ---------- */

/** 3245 -> "54:05"; 7265 -> "2:01:05" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Seconds per km -> "5:12 /km" */
export function formatPace(secPerKm: number | null, units: 'metric' | 'imperial' = 'metric'): string {
  if (secPerKm == null) return '—';
  const perUnit = units === 'imperial' ? secPerKm * 1.609344 : secPerKm;
  const m = Math.floor(perUnit / 60);
  const s = Math.round(perUnit % 60);
  return `${m}:${String(s).padStart(2, '0')} /${units === 'imperial' ? 'mi' : 'km'}`;
}

export function formatPaceRange(
  range: { minSecPerKm: number; maxSecPerKm: number } | null,
  units: 'metric' | 'imperial' = 'metric',
): string {
  if (!range) return '—';
  return `${formatPace(range.minSecPerKm, units).replace(/ \/.+$/, '')}–${formatPace(range.maxSecPerKm, units)}`;
}

export function formatDistance(km: number | null, units: 'metric' | 'imperial' = 'metric'): string {
  if (km == null) return '—';
  const v = units === 'imperial' ? km / 1.609344 : km;
  const unit = units === 'imperial' ? 'MI' : 'KM';
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}${unit}`;
}

/** "3:45:00" or "45:00" -> seconds. Returns null on anything else. */
export function parseTimeToSeconds(input: string): number | null {
  const parts = input.trim().split(':').map(Number);
  if (parts.length === 0 || parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60;
  return null;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
