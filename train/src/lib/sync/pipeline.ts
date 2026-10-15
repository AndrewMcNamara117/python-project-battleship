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

export async function finishConnect(input: {
  provider: SyncProvider;
  secret: string;
  athleteId: string;
  code: string | null;
  state: string | null;
  redirectUri: string;
  service: IronMilesRepo;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const checked = verifyState(input.secret, input.state, { athleteId: input.athleteId, provider: input.provider.name });
  if (!checked.ok) return checked;
  if (!input.code) return { ok: false, reason: 'The provider did not grant access.' };

  let tokens: SyncTokens;
  try {
    tokens = await input.provider.exchangeCode(input.code, input.redirectUri);
  } catch {
    return { ok: false, reason: `${input.provider.label} did not accept the connection. Try again.` };
  }

  // one watch account belongs to one athlete
  const existing = await input.service.findConnection(input.provider.name, tokens.externalUserId);
  if (existing && existing.athleteId !== input.athleteId) {
    return { ok: false, reason: `That ${input.provider.label} account is already connected to another Iron Miles athlete.` };
  }

  await input.service.saveConnection({
    athleteId: input.athleteId,
    provider: input.provider.name,
    externalUserId: tokens.externalUserId,
    sealedTokens: encryptTokens(input.secret, tokens),
    expiresAt: tokens.expiresAt,
  });
  return { ok: true };
}

export interface PushReport {
  status: number;
  imported: number;
  duplicates: number;
  failed: number;
  detail: string;
}

/** Refresh when within a minute of expiry, and store what comes back. */
async function liveTokens(provider: SyncProvider, secret: string, service: IronMilesRepo, athleteId: string, sealed: string): Promise<SyncTokens> {
  const tokens = decryptTokens<SyncTokens>(secret, sealed);
  const expiring = tokens.expiresAt != null && Date.parse(tokens.expiresAt) - Date.now() < 60_000;
  if (!expiring || !provider.refresh) return tokens;
  const fresh = await provider.refresh(tokens);
  await service.saveConnection({
    athleteId,
    provider: provider.name,
    externalUserId: fresh.externalUserId || tokens.externalUserId,
    sealedTokens: encryptTokens(secret, fresh),
    expiresAt: fresh.expiresAt,
  });
  return fresh;
}

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
  } catch {
    // tokens unreadable or refresh refused: the athlete must reconnect; 200 so this push is not retried for ever
    return report(200, 'Connection needs renewing.');
  }

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
      const detail = e instanceof ActivityFileError ? e.message : 'Fetch or import failed.';
      await service.finishImport(provider.name, a.externalId, 'failed', null, detail);
    }
  }
  if (counts.imported) await service.markSynced(connection.athleteId, provider.name);
  return report(200, 'Processed.', counts);
}

export async function disconnect(provider: SyncProvider, athleteId: string, service: IronMilesRepo): Promise<void> {
  await service.removeConnection(athleteId, provider.name);
}
