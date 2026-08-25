/**
 * Fixed-window rate limiter, in process memory.
 *
 * Good enough for a single instance and for blunting form abuse. On a
 * multi-instance deployment this should move to Upstash Redis or Supabase —
 * the call sites do not change, only this file does.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/** Opportunistic cleanup so the map cannot grow without bound. */
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (now > bucket.resetAt) buckets.delete(key);
}
