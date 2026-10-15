/**
 * WHAT A WATCH PROVIDER IS, AS FAR AS IRON MILES IS CONCERNED.
 *
 * Written the way the email seam is (src/lib/notifications/email/provider.ts):
 * everything above this file — state, token storage, dedupe, the import —
 * does not know which provider it is talking to. Garmin, COROS and Strava
 * each become one file implementing this, written against their own partner
 * documentation once access is granted.
 *
 * The contract every provider fits: the athlete authorises once (OAuth), the
 * provider tells us a new activity exists (a signed push), and we fetch it as
 * a file. What arrives goes through the same import as an upload.
 */

export type SyncProviderName = 'garmin' | 'coros' | 'strava';

export interface SyncTokens {
  accessToken: string;
  refreshToken: string | null;
  /** ISO timestamp; null when the provider's tokens do not expire. */
  expiresAt: string | null;
  /** The provider's id for this athlete — how a push is routed to them. */
  externalUserId: string;
}

/** One new activity, as a push announces it. */
export interface PushedActivity {
  externalId: string;
  /** Provider-specific pointer to the file (a URL, an id). */
  ref: string;
}

export interface SyncProvider {
  name: SyncProviderName;
  label: string;
  configured(): boolean;
  /** What is missing, in words for the person setting it up. */
  setupRequired: string | null;
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<SyncTokens>;
  /** Called when tokens have expired. Providers without refresh omit it. */
  refresh?(tokens: SyncTokens): Promise<SyncTokens>;
  /** Raw body, because a signature covers the exact bytes. */
  verifyPush(raw: string, headers: Headers): { ok: true } | { ok: false; reason: string };
  readPush(payload: unknown): { externalUserId: string; activities: PushedActivity[] } | null;
  fetchFile(tokens: SyncTokens, activity: PushedActivity): Promise<Uint8Array>;
}

export const PROVIDER_LABELS: Record<SyncProviderName, string> = {
  garmin: 'Garmin Connect',
  coros: 'COROS',
  strava: 'Strava',
};

/** Largest file a push may make us download. Matches uploads. */
export const MAX_SYNC_FILE_BYTES = 25 * 1024 * 1024;
