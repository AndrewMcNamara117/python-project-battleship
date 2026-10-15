# Watch sync

Activities can reach Iron Miles three ways. Two work today without anyone's
permission; the third needs each watch company to let us in.

| | Works today | Needs |
|---|---|---|
| **Import a file** (`/app/activities`) | Yes — FIT, GPX, TCX, gzipped too | Nothing |
| **Record in the browser** (`/app/record`) | Yes — phone GPS, screen on | Nothing |
| **Automatic sync** (Profile → Connected apps) | Pipeline built and tested | Partner approval from Garmin / COROS |

---

## What is built

Everything except the part only a partner can write:

- **Connect.** `/api/sync/<provider>/connect` sends the athlete to the provider
  with a signed, ten-minute `state` bound to that athlete; the callback refuses
  a state started by anyone else (`src/lib/sync/crypto.ts`).
- **Tokens.** Stored AES-256-GCM-encrypted in `integration_secrets`
  (migration 0028), a table with RLS on and **no policy at all** — no athlete,
  coach or admin session can read it. Only the server, after authorising the
  request, touches it. Refreshed automatically when they expire.
- **Push.** `/api/sync/<provider>/push` verifies the provider's signature over
  the raw body, finds the athlete by the provider's user id, claims each
  activity in `activity_imports` (so a retried push never imports twice, and a
  push whose fetch failed *is* retried), fetches the file, and imports it
  exactly like an upload — matching, privacy trim, segments, records.
- **Disconnect** deletes the sealed tokens, not just a flag.

It is proven end to end over real HTTP against a simulated provider
(`src/lib/sync/simulator.ts`, `e2e/sync.mjs`): the OAuth round trip in a
browser, a signed push, the authorised file fetch, the import, a duplicate
push, a forged push, and a push after disconnecting.

## What you need to do

### 1. Apply for access — now; approval takes weeks

- **Garmin Connect Developer Program** — apply for the *Activity API*. You
  will be asked what the integration does: *"A coaching platform for the Iron
  Miles running club in Limerick; athletes connect their own Garmin account so
  the activities they record arrive on their coach-written training plan."*
- **COROS API** — apply through COROS's partner programme with the same
  description.

### 2. When access is granted

Each provider becomes one file in `src/lib/sync/` implementing the
`SyncProvider` interface in `provider.ts` — authorise URL, code exchange,
refresh, push signature, push body, file fetch — written against that
provider's partner documentation, and one line in `providers.ts` to select
it. Nothing else changes.

### 3. Switch it on

```
SYNC_SECRET=<at least 32 random characters — openssl rand -hex 24>
```

Then register these with the provider:

```
Redirect URI:  https://train.ironmiles.ie/api/sync/garmin/callback
Push URL:      https://train.ironmiles.ie/api/sync/garmin/push
```

`SYNC_SECRET` encrypts every stored token. **Changing it disconnects
everyone** (their tokens can no longer be read) — they reconnect once.
`SUPABASE_SERVICE_ROLE_KEY` must also be set: only the server role can write
tokens and activities on an athlete's behalf.

## Strava

Not planned. Strava's API agreement restricts showing an athlete's Strava
data to other people, and showing it to their coach is the whole point here.
Files exported from Strava (single activities, or the bulk export's
`.fit.gz` files) import through Activities today.

## Apple Health and Health Connect

Both are on-device APIs: they need the native phone app. Until then, apps
such as HealthFit and RunGap export files that import today. Google Fit, the
old Android route, is being retired by Google in favour of Health Connect.
