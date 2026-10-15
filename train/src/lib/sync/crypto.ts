import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The two secrets a provider connection needs kept.
 *
 *  - OAuth `state`: signed, expiring, and bound to the athlete who started
 *    the connection, so a callback cannot be replayed into someone else's
 *    account (the login-CSRF that OAuth's state parameter exists to stop).
 *  - Provider tokens: AES-256-GCM, so a database read — a backup, a
 *    misconfigured policy — yields ciphertext, not the keys to an athlete's
 *    watch account. The table they live in has no client policy at all.
 *
 * Both keys derive from SYNC_SECRET, with distinct labels, so one leaked
 * purpose never unlocks the other.
 */

const key = (secret: string, purpose: string) => createHash('sha256').update(`${secret}:${purpose}`).digest();
const b64u = (b: Buffer) => b.toString('base64url');

export interface SyncState {
  athleteId: string;
  provider: string;
  /** ms since epoch. */
  expiresAt: number;
  nonce: string;
}

const STATE_TTL_MS = 10 * 60 * 1000;

export function signState(secret: string, athleteId: string, provider: string, now = Date.now()): string {
  const body: SyncState = { athleteId, provider, expiresAt: now + STATE_TTL_MS, nonce: b64u(randomBytes(12)) };
  const payload = b64u(Buffer.from(JSON.stringify(body)));
  const mac = b64u(createHmac('sha256', key(secret, 'state')).update(payload).digest());
  return `${payload}.${mac}`;
}

export function verifyState(
  secret: string,
  state: string | null,
  expect: { athleteId: string; provider: string },
  now = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  if (!state || !state.includes('.')) return { ok: false, reason: 'Missing state.' };
  const [payload, mac] = state.split('.', 2);
  const good = createHmac('sha256', key(secret, 'state')).update(payload).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== good.length || !timingSafeEqual(given, good)) return { ok: false, reason: 'State signature did not match.' };
  let body: SyncState;
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SyncState;
  } catch {
    return { ok: false, reason: 'State was unreadable.' };
  }
  if (body.expiresAt < now) return { ok: false, reason: 'The connection took too long. Start again.' };
  if (body.athleteId !== expect.athleteId) return { ok: false, reason: 'This connection was started by someone else.' };
  if (body.provider !== expect.provider) return { ok: false, reason: 'State was for a different provider.' };
  return { ok: true };
}

export function encryptTokens(secret: string, plain: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret, 'tokens'), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(plain), 'utf8'), cipher.final()]);
  return ['v1', b64u(iv), b64u(cipher.getAuthTag()), b64u(data)].join('.');
}

export function decryptTokens<T>(secret: string, sealed: string): T {
  const [v, iv, tag, data] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised token format');
  const decipher = createDecipheriv('aes-256-gcm', key(secret, 'tokens'), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const plain = Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as T;
}

/** HMAC-SHA256 of the raw body, hex — the simulator's webhook signature, and a common provider scheme. */
export function hmacHex(secret: string, raw: string): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

export function safeEqualHex(a: string | null, b: string): boolean {
  if (!a) return false;
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
