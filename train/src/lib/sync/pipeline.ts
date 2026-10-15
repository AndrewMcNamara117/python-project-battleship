import type { IronMilesRepo } from '@/lib/data/repo';
import { importActivity } from '@/lib/activity/service';
import { ActivityFileError } from '@/lib/activity/types';
import { decryptTokens, encryptTokens, signState, verifyState } from './crypto';
import type { SyncProvider, SyncTokens } from './provider';

/**
 * The sync pipeline, provider-agnostic.
 *
 * Every function takes the repo it may use. The connect step runs on the
 * athlete's own request; a push arrives with no session at all, so it uses
 * the service repo — and therefore authorises itself: the signature proves
 * the provider sent it, and the provider's user id is the only thing that
 * chooses whose account a file lands in.
 */

export function connectUrl(provider: SyncProvider, secret: string, athleteId: string, redirectUri: string): string {
  return provider.authorizeUrl(signState(secret, athleteId, provider.name), redirectUri);
}

/** Why a connection failed, as a code: the profile page maps it to its own words. */
export type ConnectFailure = 'state' | 'expired' | 'denied' | 'refused' | 'taken' | 'error';

export async function finishConnect(input: {
  provider: SyncProvider;
  secret: string;
  athleteId: string;
  code: string | null;
  state: string | null;
  redirectUri: string;
  service: IronMilesRepo;
}): Promise<{ ok: true } | { ok: false; reason: string; code: ConnectFailure }> {
  const checked = verifyState(input.secret, input.state, { athleteId: input.athleteId, provider: input.provider.name });
  if (!checked.ok) return { ...checked, code: /too long/.test(checked.reason) ? 'expired' : 'state' };
  if (!input.code) return { ok: false, reason: 'The provider did not grant access.', code: 'denied' };

  let tokens: SyncTokens;
  try {
    tokens = await input.provider.exchangeCode(input.code, input.redirectUri);
  } catch {
    return { ok: false, reason: `${input.provider.label} did not accept the connection. Try again.`, code: 'refused' };
  }

  // one watch account belongs to one athlete
  const taken = { ok: false as const, reason: `That ${input.provider.label} account is already connected to another Iron Miles athlete.`, code: 'taken' as const };
  const existing = await input.service.findConnection(input.provider.name, tokens.externalUserId);
  if (existing && existing.athleteId !== input.athleteId) return taken;

  try {
    await input.service.saveConnection({
      athleteId: input.athleteId,
      provider: input.provider.name,
      externalUserId: tokens.externalUserId,
      sealedTokens: encryptTokens(input.secret, tokens),
      expiresAt: tokens.expiresAt,
    });
  } catch (e) {
    // two athletes finishing at once for the same account: the unique
    // constraint decided, after the check above passed for both
    if (/duplicate key|unique/i.test(e instanceof Error ? e.message : '')) return taken;
    return { ok: false, reason: 'The connection could not be saved. Try again.', code: 'error' };
  }
  return { ok: true };
}

export interface PushReport {
  status: number;
  imported: number;
  duplicates: number;
  failed: number;
  detail: string;
}

/** The tokens could not be used, and retrying will not change that: the athlete must reconnect. */
class ReconnectNeeded extends Error {}
/** The athlete disconnected while this push was in flight. */
class Disconnected extends Error {}

/**
 * Refresh when within a minute of expiry, and store what comes back — as an
 * update, never an upsert, so a refresh racing a disconnect cannot bring
 * the connection back.
 */
async function liveTokens(provider: SyncProvider, secret: string, service: IronMilesRepo, athleteId: string, sealed: string): Promise<SyncTokens> {
  let tokens: SyncTokens;
  try {
    tokens = decryptTokens<SyncTokens>(secret, sealed);
  } catch {
    throw new ReconnectNeeded('tokens unreadable'); // SYNC_SECRET changed
  }
  const expiring = tokens.expiresAt != null && Date.parse(tokens.expiresAt) - Date.now() < 60_000;
  if (!expiring || !provider.refresh) return tokens;
  let fresh: SyncTokens;
  try {
    fresh = await provider.refresh(tokens);
  } catch (e) {
    // a push alongside this one may have refreshed first, spending the
    // refresh token a provider that rotates them will now refuse: use theirs
    const now = await service.getConnection(athleteId, provider.name);
    if (!now) throw new Disconnected();
    if (now.sealedTokens !== sealed) return decryptTokens<SyncTokens>(secret, now.sealedTokens);
    throw e;
  }
  const stored = await service.updateTokens(athleteId, provider.name, encryptTokens(secret, fresh), fresh.expiresAt);
  if (!stored) throw new Disconnected();
  return fresh;
}

/**
 * What the provider hears back decides whether it tries again, so the status
 * is chosen with care: 200 for everything settled — imported, duplicate, a
 * file that is not an activity, nobody to give it to — and 503 when any
 * activity failed for a reason a retry could fix (a timeout, the provider's
 * own outage, our database). A retry is safe: what already imported is a
 * duplicate the second time.
 */
export async function handlePush(input: {
  provider: SyncProvider;
  secret: string;
  raw: string;
  headers: Headers;
  service: IronMilesRepo;
}): Promise<PushReport> {
  const { provider, secret, service } = input;
  const report = (status: number, detail: string, counts = { imported: 0, duplicates: 0, failed: 0 }): PushReport => ({ status, detail, ...counts });

  if (!provider.configured()) return report(503, 'Provider not configured.');
  const verified = provider.verifyPush(input.raw, input.headers);
  if (!verified.ok) return report(401, verified.reason);

  let payload: unknown;
  try {
    payload = JSON.parse(input.raw);
  } catch {
    return report(400, 'Body was not JSON.');
  }
  const push = provider.readPush(payload);
  // a signed push of a kind we do not act on: acknowledge so it is not retried
  if (!push) return report(200, 'Ignored.');

  const connection = await service.findConnection(provider.name, push.externalUserId);
  // nobody here owns that watch account any more: 200, so the provider stops
  if (!connection) return report(200, 'No connected athlete.');
  const profile = await service.getProfile(connection.athleteId);
  if (!profile) return report(200, 'No connected athlete.');

  const counts = { imported: 0, duplicates: 0, failed: 0 };
  let tokens: SyncTokens;
  try {
    tokens = await liveTokens(provider, secret, service, connection.athleteId, connection.sealedTokens);
  } catch (e) {
    if (e instanceof Disconnected) return report(200, 'No connected athlete.');
    // say so where the athlete will see it, rather than dropping every run in silence
    await service.markNeedsReconnect(connection.athleteId, provider.name);
    // unreadable tokens will not become readable; a refused refresh may be
    // the provider's outage, and is worth the provider's retry
    return e instanceof ReconnectNeeded ? report(200, 'Connection needs renewing.') : report(503, 'Could not refresh the connection.');
  }

  let retryable = 0;
  for (const a of push.activities) {
    if (!(await service.claimImport(provider.name, a.externalId, connection.athleteId))) {
      counts.duplicates++;
      continue;
    }
    try {
      const bytes = await provider.fetchFile(tokens, a);
      const out = await importActivity(service, profile, bytes, service, provider.name);
      const isDup = out.status === 'duplicate';
      if (isDup) counts.duplicates++;
      else counts.imported++;
      await service.finishImport(provider.name, a.externalId, isDup ? 'duplicate' : 'imported', out.activity.id, out.status);
    } catch (e) {
      counts.failed++;
      const permanent = e instanceof ActivityFileError;
      if (!permanent) retryable++;
      // a failure to record the failure must not stop the rest of the push;
      // a claim left behind is reclaimed once it goes stale
      await service
        .finishImport(provider.name, a.externalId, 'failed', null, permanent ? e.message : 'Fetch or import failed.')
        .catch(() => {});
    }
  }
  if (counts.imported) await service.markSynced(connection.athleteId, provider.name);
  return retryable ? report(503, 'Some activities could not be fetched; retry.', counts) : report(200, 'Processed.', counts);
}

export async function disconnect(provider: SyncProvider, athleteId: string, service: IronMilesRepo): Promise<void> {
  await service.removeConnection(athleteId, provider.name);
}
