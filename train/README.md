# Iron Miles Training

A coaching and athlete training hub for the Iron Miles endurance community — Limerick, Ireland.
Deployed at **train.ironmiles.ie**, separate from the marketing site at ironmiles.ie.

**FORGE ONE MORE.**

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

With no environment variables set the app runs in **demo mode** and is fully explorable — see
[Demo mode](#demo-mode) below. Copy `.env.example` to `.env.local` to attach real services.

```bash
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

---

## The one architectural decision worth knowing

Every page and server action talks to a single interface, `IronMilesRepo`
(`src/lib/data/repo.ts`). Two implementations satisfy it:

| Adapter | File | Used when |
|---|---|---|
| `SupabaseRepo` | `src/lib/data/supabase-repo.ts` | `NEXT_PUBLIC_SUPABASE_URL` and `..._ANON_KEY` are set |
| `DemoRepo` | `src/lib/data/demo-repo.ts` | otherwise |

`getRepo()` picks by environment, never by user input. Components never import either adapter, so
attaching a database changes no component code.

This exists because a coaching platform that only runs once someone provisions Postgres cannot be
reviewed, demoed or developed against. It is not mock UI — it is one interface with two backends.

### Demo mode

A deterministic dataset built per calendar day (`src/data/demo-seed.ts`): a demo athlete training
for the Connemara Ultra 218 days out, with 20 weeks of history at realistic adherence, weekly
check-ins, a Forge Score ledger, a club leaderboard, and a coach. Same day in, same data out.

Enter from `/login` — "Enter as athlete" or "Enter as coach". The demo entry action returns without
doing anything when Supabase credentials are present, so it cannot become a back door.

Demo writes mutate an in-process object and survive only as long as the server process. That is
correct for a demo and must never be production storage; `getRepo()` guarantees it never is.

---

## The coach ↔ athlete loop

This is the workflow the product exists to serve. Every step runs end to end and
is covered by `e2e/loop.mjs`.

1. **Someone applies** at `/apply`. Public, rate limited, validated server-side.
2. **A coach reviews** at `/coach/applications` and accepts, declines, or marks
   reviewing. The decision goes through `im_decide_application`, a
   security-definer function that re-checks the caller is staff.
3. **The athlete is created and linked.** A coach cannot create an account — a
   profile row is tied to an `auth.users` row. So acceptance records the
   decision, and the sign-up trigger forms the coach-athlete link (and the
   message thread) the moment that person registers with the address they
   applied with. If they already have an account, they are linked immediately.
4. **Onboarding** captures the goal, history, availability, health screen and
   coaching preferences, and writes the athlete's primary goal.
5. **The coach assigns a programme** at `/coach/programs`. This creates a
   `programs` row and copies every session into the athlete's own calendar, so
   editing one athlete never touches another.
6. **The athlete completes sessions** and logs distance, duration, RPE, heart
   rate, soreness and notes.
7. **The coach sees it** on the athlete's page — logs, adherence, charts.
8. **The coach edits the plan** inline on that page: rename, retype, re-date,
   change distance or RPE, add a coach note, or remove a session. Completed
   sessions are locked; they are a record, not a plan.
9. **The athlete sees the change** on their next page load.
10. **The weekly check-in** captures seven scores and six questions.
11. **Triage routes it.** Rule-based, server-side. Cross-week patterns and
    red-flag language escalate to the coach's queue.
12. **Forge Score updates** from the session, the check-in and weekly adherence.

## Setting up Supabase

1. Create a project, then run the migrations in order:

   ```
   supabase/migrations/0001_schema.sql      # tables, enums, foreign keys, triggers
   supabase/migrations/0002_rls.sql         # row-level security — read this one
   supabase/migrations/0003_acceptance.sql  # intake: acceptance and auto-linking
   …                                        # and every later file, in order, through
   supabase/migrations/0021_activities.sql  # imported watch activities
   supabase/migrations/0022_club_feed.sql   # member directory fix, club feed
   supabase/migrations/0023_segments.sql    # segments and server-written efforts
   supabase/migrations/0024_forge_awards.sql # Forge points awarded by triggers
   supabase/migrations/0025_best_efforts.sql # personal-record data on activities
   supabase/migrations/0026_social_notifications.sql # kudos and comment notices
   supabase/migrations/0027_challenges.sql   # club challenges
   supabase/migrations/0028_sync.sql         # watch sync: sealed tokens, push ledger
   ```

2. Put the project URL, anon key and service-role key in `.env.local`.
3. Restart. Every read and write now goes to Postgres.

### Security model

RLS is the enforcement boundary, not the application. Default deny on every table, then:

- An athlete reads and writes their own rows, and nothing else.
- A coach reads rows for athletes **actively linked** to them via `coach_athlete_links`.
- Private coach notes are invisible to the athlete by policy, not by a UI filter.
- The Forge ledger and billing tables are read-only to clients; only the service role writes them.
- Leaderboard visibility requires `leaderboard_opt_in`, which is `false` by default. Other members
  see an opted-in athlete only through `im_leaderboard_members()` — id, name, avatar, group. The
  profile row itself (email, date of birth, injury notes) is never readable by another member.
  Until migration 0022 it was: RLS is row-level, and the opt-in policy exposed the whole row.
- `im_export_athlete_data()` returns an athlete's full record for GDPR export.
- Deleting a profile cascades through every athlete-owned table.

Middleware (`src/middleware.ts`) is the coarse gate and refreshes the Supabase session. A request
that slipped past it still could not read another athlete's data.

---

## Testing

Four suites. The first three need nothing but `npm install`.

```bash
npm run typecheck
npm run lint
npm test              # unit + RLS
npm run test:rls      # RLS only

# the two browser suites need a running server, in demo mode
npm run build && npx next start -p 3000 &
BASE_URL=http://localhost:3000 npm run test:e2e      # the coach ↔ athlete loop, 19 steps
BASE_URL=http://localhost:3000 npm run test:guards   # access control + failure states, 53 checks
```

**`supabase/test/rls.test.mjs` is the one to read first.** It runs the shipped
migrations against a real Postgres — PGlite, Postgres compiled to WASM — as a
non-superuser role, so the policies actually execute. It proves the claims this
product makes about privacy rather than asserting them:

- an athlete reads their own rows and no one else's, by id or otherwise
- a coach reads only athletes actively linked to them
- private coach notes are invisible to the athlete even when asked for directly
- an athlete cannot promote themselves, award themselves Forge points, grant
  themselves a subscription, send a message as someone else, or post as FORGE
- leaderboard opt-in exposes a name and a score — never training or check-in data
- accepting an application links the athlete automatically on sign-up
- an export refuses any subject but yourself, coaches included
- deleting a profile cascades through every table that references it

`e2e/loop.mjs` needs a freshly started server: demo state lives in the server
process, so a second run against the same process is a different starting state.
It detects that and says so rather than failing obscurely.

---

## Activities

Athletes import watch files at `/app/activities` — **.fit**, **.gpx** or **.tcx**, gzipped or not
(Strava's bulk export ships `.fit.gz`). Format is sniffed from the bytes, never the file name.
Everything lives in `src/lib/activity/` and has no dependencies.

| File | What it does |
|---|---|
| `fit.ts`, `xml.ts` | Decoders. FIT checks its CRC; GPX/TCX are scanned linearly and never expand entities |
| `analyse.ts` | Distance (device channel first, GPS with teleports dropped), moving time, splits, elevation with a dead band, HR zones |
| `route.ts` | Privacy trim, privacy zones (cut as gaps, never bridged), simplification, encoded polyline |
| `match.ts` | Which planned session the file was — automatic only when exactly one fits |
| `service.ts` | Import → dedupe → match → log or enrich → link; attach; delete |
| `fixtures.ts` | Writes real FIT/GPX/TCX bytes from a synthetic run, for tests and the demo |

What is stored is numbers, never the file: no raw GPS track is kept anywhere. The route saved is
the trimmed, simplified line (start and finish hidden by the athlete's `privacy_trim_m`, 200 m by
default). Zones are cut at render time from a stored bpm histogram against the athlete's
**measured** max HR — never an age formula — so changing max HR re-cuts every past activity.

Rules worth knowing:

- An import completes a session only when exactly one session that day fits the sport. Two
  candidates → the athlete picks; none → the activity is kept unattached.
- A session already logged by hand is **enriched**, never overwritten: the file fills blanks only.
- Re-logging by hand afterwards keeps the watch's heart rate and pace.
- Deleting an activity removes its log only if the import created that log.
- The same file twice, or the same run exported as FIT and as GPX, is one activity.
- Coaches read activities (`/coach/athletes/[id]/activities/[activityId]`), never write them.
  A DB trigger refuses linking an activity to anyone else's session or log.

Uploads are gzipped in the browser before sending, so a 12-hour GPX stays under Vercel's 4.5 MB
request ceiling (`serverActions.bodySizeLimit` is 4.4 MB).

Tests: `src/lib/activity/*.test.ts` (unit + service), `supabase/test/activities.test.mjs` (RLS),
`e2e/activities.mjs` (browser: `npm run test:activities`).

---

## Club feed

`/app/club` — runs members chose to share. Sharing is per activity (a toggle on the activity page)
with an opt-in default for new imports; both start off.

What the club sees is the run: route (already privacy-trimmed), distance, time, pace, climb, kudos
and comments. **Never heart rate, splits or the plan** — those stay between athlete and coach.
Postgres enforces it the same way as the leaderboard: there is no club-wide policy on
`activities`; members read through `im_club_feed()`, `im_feed_item()` and
`im_activity_social()`, which return only those columns (migration 0022).

- Kudos: once per member, on a shared run, never your own.
- Comments: members on shared runs; the coach on any run of their athlete's; 1–500 characters.
  The author, the activity's athlete and staff may remove one.
- Un-sharing hides the conversation from the club; it is kept for the athlete and coach.
- Nothing in the feed is ranked, and kudos earn no Forge points.

Tests: `supabase/test/club-feed.test.mjs` (RLS), `src/lib/activity/club.test.ts` (demo parity),
and steps 16–21 of `e2e/activities.mjs`.

---

## Segments

`/app/segments` — named stretches around Limerick, drawn by coaches from an athlete's route
(`/coach/athletes/[id]/activities/[activityId]` → "Draw a segment from this route"), managed at
`/coach/segments`. The demo has three: Canal bank drag, Riverside mile, Castletroy climb.

- **Timed at import, from the full track** (`src/lib/activity/segments.ts`). An effort must pass
  near the start, every checkpoint along the segment, and the finish, over a distance close to the
  segment's own, at a speed a person could manage for that sport. The raw track is never stored, so
  **a new segment times runs imported after it exists, not before.**
- **Only the server writes a time.** Migration 0023 has no insert or update policy on
  `segment_efforts`; the import action writes through the service repo after computing the time from
  the athlete's own file. Without `SUPABASE_SERVICE_ROLE_KEY` imports still work, untimed.
- **The club board counts shared runs only** (`im_segment_leaders`). A time from a private run is
  the athlete's and their coach's.
- **Privacy:** an effort that starts or ends inside the athlete's hidden stretch is dropped, and a
  coach cannot draw a segment within 500 m of either visible end of an athlete's route.
- Personal bests are announced on import only when an earlier time is beaten.

Tests: `src/lib/activity/segments.test.ts` (matching), `segment-import.test.ts` (through the
import), `supabase/test/segments.test.mjs` (RLS), steps 21–24 of `e2e/activities.mjs`.

---

## Training load and personal records

**Training load** (`src/lib/domain/load.ts`, `src/lib/activity/training-load.ts`) — session-RPE:
effort out of ten × minutes, for runs and strength alike. An imported run without an RPE is
estimated from time in heart-rate zones (when max HR is set) and counted as an estimate; a session
with neither is counted as unscored, never guessed. Fitness is the 42-day exponentially weighted
average, fatigue the 7-day, form the difference; the ratio is the last 7 days against the 28-day
weekly average, banded easing / steady / building / building fast. It replaced the old
kilometres-only load ratio. Shown to the coach (athlete page) and the athlete (Progress), worded
as context, never an instruction.

**Personal records** (`src/lib/activity/records.ts`) — the fastest 1K, mile, 5K, 10K, half and
marathon *inside* every imported run, found at import from the full track and kept on the
activity (`best_efforts`, migration 0025). Records are the minimum per distance across activities,
so deleting a run hands its records back. An import that beats an earlier time says so; a first
time does not. Watch files only, and only runs imported since records existed.

---

## Recording in the browser

`/app/record` — GPS from the phone, for a run without a watch. The recorder
(`src/lib/activity/recorder.ts`) drops vague fixes (worse than ±35 m) and impossible jumps, adds
no distance for GPS drift at a standstill, and nothing across a pause. It saves as **TCX** so the
import keeps the recorder's own distance rather than re-deriving it (which would bridge a pause
with a straight line); then it is an ordinary import — matching, privacy trim, segments, records.

Limits, stated on the page: a browser records only while the page is on screen. A wake lock keeps
the screen awake; if the phone is locked anyway, the page says how long the gap was. The track is
kept in the phone's storage as it grows, so a refresh or crashed tab does not lose a run. The
`Permissions-Policy` header allows geolocation for this origin only (`geolocation=(self)`).
Recording with the screen locked needs a native app.

Tests: `src/lib/activity/recorder.test.ts`, and `e2e/record.mjs` (simulated GPS, a real minute).

---

## Notifications for athletes, and club challenges

**Inbox** (`/app/notifications`, count in the top bar). Kudos and comments on an athlete's
activities are written there by triggers (migration 0026): kudos fold into one notification per
activity, each comment is its own with an excerpt, nobody is told about their own action, and
`profiles.notify_social` turns it off. In-app only — email goes through `notification_deliveries`,
which only `im_notify` (the coach channel) creates. Opening a notification marks it read; loading
the page does not.

**Challenges** (`/app/challenges`, set at `/coach/challenges`). A target over a window of up to a
year — sessions completed as written, club runs, weekly check-ins, or kilometres — that athletes
opt into. **Finished, not won**: nothing is ranked. Progress is computed from the athlete's own
rows (never submitted), visible to them and their coach; the club sees how many joined and who
finished, via `im_challenge_summary`. The progress rule exists in SQL (migration 0027) and in
`src/lib/domain/challenges.ts` for the demo; the challenges RLS suite and demo parity tests keep
them in step. A distance challenge warns the coach that it rewards volume.

---

## Stripe

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRICE_EVENT_READY`. Without them the
billing page renders a labelled unavailable state rather than a broken button.

- `POST /api/stripe/checkout` — subscription checkout. Prices resolve server-side from the package
  code; the client never sends an amount.
- `POST /api/stripe/portal` — Stripe's billing portal (cancel, pause, card, invoices).
- `POST /api/stripe/webhook` — signature-verified. An unsigned body is rejected before it is parsed.

Pricing is a list (`src/data/packages.ts`) so additional tiers drop in without touching the pricing
page, checkout route or webhook.

---

## Scheduled jobs

`GET /api/cron/<job>`, authorised by a constant-time bearer check against `CRON_SECRET`. Without
that variable set the endpoint refuses every request rather than defaulting open. Schedules are in
`vercel.json`.

| Job | When | What |
|---|---|---|
| `morning-reminder` | 06:00 daily | Today's session, via FORGE |
| `session-incomplete` | 19:00 daily | Prescribed today, still unlogged |
| `checkin-request` | Sun 17:00 | Weekly check-in is open |
| `weekly-summary` | Sun 18:00 | Adherence, long run, strength, fatigue |
| `race-countdown` | 06:30 daily | Milestone days only — 180, 120, 90, 60, 30, 21, 14, 7, 3, 1, 0 |
| `coach-alerts` | Mon 08:00 | Repeated missed sessions, or a flagged check-in |

Each job returns a report of what it sent. In demo mode it computes the same output and reports it
as a dry run, so the logic is testable before anyone's phone is involved.

---

## FORGE

The training assistant (`src/lib/forge/`). Deterministic and rule-based — there is no model behind
it. It reflects logged data back and explains what is scheduled.

Hard limits, enforced in code rather than trusted to a prompt:

- Never names, grades or diagnoses an injury or condition.
- Never says to push through pain or ignore a symptom.
- Never mentions medication.
- Red-flag language (chest pain, dizziness, fainting, numbness, sharp or worsening pain)
  short-circuits every other message and returns stop-and-seek-care. That path cannot be disabled.
- Anything it does not have an answer for is routed to the human coach, never improvised.

A coach can disable FORGE per athlete (`profiles.forge_assistant_enabled`); that switch is checked
before anything is generated.

---

## Forge Score

Rewards *doing the plan*, not exceeding it — running further than prescribed earns nothing, because
a leaderboard that rewarded raw volume would reward overtraining. Rules live in
`src/lib/domain/forge-score.ts`. The ledger is idempotent: a unique index on
`(athlete, kind, source)` means re-running an award is harmless.

Against Postgres, points are awarded **by the database** (migration 0024): triggers on
`completed_workouts`, `scheduled_workouts`, `strength_sessions` and `checkins` write the ledger.
There is no callable award function — Supabase grants clients execute on new functions, and a
trigger function cannot be called directly — so nobody awards themselves. The full-week bonus is
given as soon as every non-rest session of the week is complete. The demo adapter applies the same
rules in code.

---

## Check-in triage

`src/lib/domain/checkin-rules.ts` decides whether a coach should see a check-in sooner. It is a
routing tool, not a clinical one: it does not diagnose, grade or name anything, and its output is
always phrased as a recommendation to a coach. Triage runs server-side, so the flag cannot be
spoofed by a client.

---

## Layout

```
src/
  app/
    (public)/         landing, coaching, pricing, apply, login, register, privacy, terms
    app/              athlete hub — dashboard, today, calendar, training, strength,
                      progress, check-in, leaderboard, community, coach, forge, profile
    coach/            coach hub — overview, athletes, check-in queue, messages,
                      programmes, libraries, races, analytics
    onboarding/       seven-step athlete onboarding
    api/              stripe/*, cron/[job], auth callback
    actions/          server actions (auth, training, coach, profile, onboarding, public)
  components/         brand, ui, motion, charts, app shell, landing, public
  lib/
    domain/           types, dates, analytics, forge-score, check-in rules
    data/             the repo interface and its two adapters
    forge/            the assistant and its answer set
  data/               seeded libraries and the demo dataset
supabase/migrations/  schema and RLS
```

---

## Design system — v1.0

Canonical values live in **`src/lib/tokens.ts`**, mirrored into CSS custom properties in
`globals.css`. Change both together. Nothing else in the codebase should contain a colour literal.

**Surfaces** Onyx `#0B0B0B` · Charcoal `#111418` · Slate `#1A1F23` · Steel `#2A2F35` — cool
neutral, never green-tinted. **Accent** Iron Miles Mint `#2DFF8A`, the only hue in the system.

**Ink is assigned by measured contrast**, not by eye. Each token records its ratio on Charcoal:
`ink` 18.5:1 (headings, hero numerals) · `ink-body` 14.8:1 (body, workout instructions) ·
`ink-secondary` 7.3:1 (labels, captions, axis) · `ink-tertiary` 5.0:1 (the dimmest step that still
clears AA) · `ink-faint` 3.4:1 — **below AA, constrained to hairlines and never used for text.**
That constraint closed a real defect: the token this replaced sat at 3.0:1 and carried every micro
label in the product.

**Typography** Montserrat, self-hosted. One variable file, Latin subset, 37KB, covering weights
100–900 — served from our own origin via `next/font/local`. No CDN, no runtime font request, and an
offline build still works.

### The logo is immutable

`public/brand/iron-miles-mark.svg` is the supplied file, byte-for-byte. The transparent variant is
the same file with only the opaque background rectangle removed — both polygons, their points,
fills, proportions, angles and relationship are identical to the original.

**Never redraw, reconstruct, approximate or re-derive the mark in code** — not as inline SVG, CSS,
canvas or a font glyph. `IronMilesLogo` references the asset; it does not draw it. If the mark
changes, the asset file changes and the component follows.

### ForgeLine

`src/components/forge/ForgeLine.tsx` — one continuous accent line standing for an athlete's
progression, in five contextual variants: `route` (decorative), `elevation`, `load`, `performance`
and `race`. A server component: plain SVG and CSS, no client JavaScript, no canvas, no library.

Paths carry `pathLength={1}`, so the draw is `stroke-dashoffset: 1 → 0` regardless of real
geometry — no path measurement, no layout read, no resize handler. Geometry lives in `path.ts` as
pure functions and is covered by tests: larger values must sit higher, the curve must pass through
every real point, and it must not invent a peak the data does not contain.

**It does not wait for scroll.** An earlier version gated the draw on an IntersectionObserver, which
left any line below the fold invisible until scrolled to, and invisible permanently without
JavaScript. Motion may not gate information — a CSS animation runs whether or not JavaScript does.

### TopoField

Real contour geometry with an opacity ceiling chosen by **context, not by the caller**: `marketing`
0.10, `empty` 0.07, `header` 0.055, `card` 0.035. The `safe` prop masks the field away from where
content sits. Contours are never permitted beneath numerals or workout instructions.

### Motion

`DRAW → BUILD → FORGE → COMPLETE`. Four named stages, one vocabulary — a line draws, volume builds
from a baseline, an element forges into place, a state completes. Anything mapping to none of these
does not belong in the product. Transform and opacity only.

`prefers-reduced-motion` is honoured everywhere and settles every stage to its **final** state — the
drawn line renders complete, not faded, because the data is the point.

On product surfaces use `<Rise>` (CSS-only, server-rendered, no client JS). `<Reveal>` is for
marketing pages, where scroll choreography is the intent.

### Charts

An emphasis palette, not a categorical one: the measured series wears Mint and any reference series
is deliberately recessive Steel. Where four measures must be compared (wellbeing) it facets into
small multiples rather than inventing three more hues. Never a dual-axis chart.

### Migration status

The **athlete dashboard** (`src/app/app/page.tsx`) is the reference implementation. The components
it renders are migrated to canonical token names. Everything else still uses the legacy alias layer
at the top of `globals.css`, which resolves to the new palette — so the whole product picks up the
new colours immediately, and the remaining surfaces migrate page by page without a big-bang break.

## Deployment

Vercel, pointed at `train.ironmiles.ie`. This app is not built by the repo's GitHub Pages workflow —
that only watches root `*.html`, `assets/**` and `reviews/**`, so the marketing site is unaffected.

---

## Not done yet

Named honestly rather than left to be discovered. Everything here is also
labelled in the interface, so nothing looks functional when it is not.

- **Milestones and volunteering are recorded by a coach**, not detected. The
  Forge rules list marks them "coach records" and the milestones panel says so.
- **Community reactions are read-only.** The counts are real; there is no way to
  add one, and the UI says that rather than showing a control that does nothing.
- **Provider sync** is built and tested against a simulated provider; Garmin and COROS each
  need their partner programme's approval before their adapter can be written. See SYNC.md.
  Apple Health / Health Connect need the native app.
- **Legal pages** are drafts and say so on the page. They need a solicitor's review — particularly
  on health-data handling under GDPR — before the first payment is taken.
- **Exercise video** is a labelled empty state until real footage is filmed. The player renders the
  embed the moment a `videoUrl` exists.
- **Rate limiting** is per-process memory. Multi-instance deployment needs Redis; only
  `src/lib/rate-limit.ts` changes.
- **Push notifications.** Jobs write to the `notifications` table; wiring web push is separate work.
- **Demo data** is fictional, including the coach persona. Demo writes live in
  the server process and are lost on restart; the intake queue states this
  where it matters. `getRepo()` never selects the demo adapter when Supabase
  credentials are present.
