import { hmacHex, safeEqualHex } from './crypto';
import { MAX_SYNC_FILE_BYTES, type PushedActivity, type SyncProvider, type SyncProviderName, type SyncTokens } from './provider';

/**
 * A provider that speaks a plain, documented protocol to a base URL.
 *
 * It exists for the same reason the email suite runs a local server that
 * speaks Resend's protocol: so connect → push → fetch → import is exercised
 * over real HTTP, end to end, before any partner has granted access. Set
 * SYNC_SIMULATOR_URL (and SYNC_SIMULATOR_SECRET) and it stands in for the
 * provider named by SYNC_SIMULATOR_AS. It is never selected otherwise.
 *
 *   GET  {base}/authorize?state&redirect_uri   → redirects back with ?code
 *   POST {base}/token  {code}                  → {access_token, refresh_token, expires_at, user_id}
 *   POST {base}/token  {refresh_token}         → the same, renewed
 *   GET  {base}/files/{ref}  (Bearer token)    → the activity file
 *   push: POST to our webhook, JSON {user_id, activities:[{id, ref}]},
 *         header x-sync-signature: hex HMAC-SHA256 of the body
 */
export function simulatorProvider(name: SyncProviderName, label: string, base: string, secret: string): SyncProvider {
  const asTokens = (r: { access_token: string; refresh_token?: string | null; expires_at?: string | null; user_id: string }): SyncTokens => ({
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? null,
    expiresAt: r.expires_at ?? null,
    externalUserId: String(r.user_id),
  });

  async function token(body: Record<string, string>): Promise<SyncTokens> {
    const res = await fetch(`${base}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Token endpoint said ${res.status}`);
    return asTokens(await res.json());
  }

  return {
    name,
    label: `${label} (simulated)`,
    configured: () => true,
    setupRequired: null,
    authorizeUrl: (state, redirectUri) =>
      `${base}/authorize?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    exchangeCode: (code) => token({ code }),
    refresh: (t) => token({ refresh_token: t.refreshToken ?? '' }),
    verifyPush(raw, headers) {
      return safeEqualHex(headers.get('x-sync-signature'), hmacHex(secret, raw))
        ? { ok: true }
        : { ok: false, reason: 'Signature did not match.' };
    },
    readPush(payload) {
      const p = payload as { user_id?: unknown; activities?: unknown };
      if (typeof p?.user_id !== 'string' || !Array.isArray(p.activities)) return null;
      const activities: PushedActivity[] = p.activities
        .filter((a): a is { id: string; ref: string } => typeof a?.id === 'string' && typeof a?.ref === 'string')
        .slice(0, 50)
        .map((a) => ({ externalId: a.id, ref: a.ref }));
      return { externalUserId: p.user_id, activities };
    },
    async fetchFile(t, activity) {
      // the ref is the provider's, so it is confined to the provider's own host
      const url = new URL(`files/${encodeURIComponent(activity.ref)}`, base.endsWith('/') ? base : `${base}/`);
      const res = await fetch(url, { headers: { authorization: `Bearer ${t.accessToken}` } });
      if (!res.ok) throw new Error(`File fetch said ${res.status}`);
      const len = Number(res.headers.get('content-length') ?? 0);
      if (len > MAX_SYNC_FILE_BYTES) throw new Error('File too large');
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > MAX_SYNC_FILE_BYTES) throw new Error('File too large');
      return buf;
    },
  };
}
