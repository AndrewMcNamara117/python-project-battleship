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
   ```

2. Put the project URL, anon key and service-role key in `.env.local`.
3. Restart. Every read and write now goes to Postgres.

### Security model

RLS is the enforcement boundary, not the application. Default deny on every table, then:

- An athlete reads and writes their own rows, and nothing else.
- A coach reads rows for athletes **actively linked** to them via `coach_athlete_links`.
- Private coach notes are invisible to the athlete by policy, not by a UI filter.
- The Forge ledger and billing tables are read-only to clients; only the service role writes them.
- Leaderboard visibility requires `leaderboard_opt_in`, which is `false` by default.
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
npm test              # unit + RLS: 71 assertions
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
- **Device sync.** Strava, Garmin, COROS, Apple Health and Google Fit have a schema
  (`integrations`, `activity_imports`) and a settings UI showing "coming soon". No OAuth flows.
  Manual logging is the supported path today.
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
