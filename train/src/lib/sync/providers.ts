import 'server-only';
import { optionalServerEnv } from '@/lib/env';
import { PROVIDER_LABELS, type SyncProvider, type SyncProviderName } from './provider';
import { simulatorProvider } from './simulator';

/**
 * Which providers this deployment can talk to.
 *
 * Garmin and COROS need partner-programme access before there is anything to
 * write: their push formats and file endpoints are documented to partners,
 * and guessing them would ship code that has never spoken to the real thing.
 * Until then each is listed, honestly, as awaiting access.
 *
 * Strava is listed but not planned. Its API agreement restricts showing an
 * athlete's Strava data to anyone else — and showing it to their coach is
 * the reason Iron Miles would want it. Watch files exported from Strava
 * already import through Activities.
 */

function pending(name: SyncProviderName, setupRequired: string): SyncProvider {
  const refuse = () => {
    throw new Error(`${PROVIDER_LABELS[name]} sync is not available: ${setupRequired}`);
  };
  return {
    name,
    label: PROVIDER_LABELS[name],
    configured: () => false,
    setupRequired,
    authorizeUrl: refuse,
    exchangeCode: refuse,
    verifyPush: () => ({ ok: false, reason: 'Not configured.' }),
    readPush: () => null,
    fetchFile: refuse,
  };
}

const PENDING: Record<SyncProviderName, string> = {
  garmin: 'Awaiting Garmin Connect Developer Program approval. Once granted, the adapter is one file against their Activity API.',
  coros: 'Awaiting COROS API partner approval. Once granted, the adapter is one file against their API.',
  strava: 'Not planned: Strava’s API terms restrict showing an athlete’s data to their coach. Export files from Strava and import them instead.',
};

export function syncProviders(): SyncProvider[] {
  const simUrl = optionalServerEnv('SYNC_SIMULATOR_URL');
  const simSecret = optionalServerEnv('SYNC_SIMULATOR_SECRET');
  const simAs = (optionalServerEnv('SYNC_SIMULATOR_AS') ?? 'garmin') as SyncProviderName;
  return (Object.keys(PENDING) as SyncProviderName[]).map((name) =>
    simUrl && simSecret && name === simAs ? simulatorProvider(name, PROVIDER_LABELS[name], simUrl, simSecret) : pending(name, PENDING[name]),
  );
}

export function syncProvider(name: string): SyncProvider | null {
  return syncProviders().find((p) => p.name === name) ?? null;
}

/** Sync needs SYNC_SECRET for state and token encryption; without it nothing connects. */
export function syncSecret(): string | null {
  const s = optionalServerEnv('SYNC_SECRET');
  return s && s.length >= 32 ? s : null;
}
