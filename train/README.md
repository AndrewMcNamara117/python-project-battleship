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

## Setting up Supabase

1. Create a project, then run the migrations in order:

   ```
   supabase/migrations/0001_schema.sql    # tables, enums, foreign keys, triggers
   supabase/migrations/0002_rls.sql       # row-level security — read this one
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

## Design system

Iron Black `#050505` · Miles Green `#2dff8a` · Forge White `#eeeeee`. System font stack only — no
web fonts, no CDNs. The logo is the exact supplied asset (`IronMilesMark`), never redrawn.

- `prefers-reduced-motion` is honoured everywhere; all motion collapses to static, readable content.
- Only `transform`, `opacity` and SVG attributes are animated.
- Charts use an emphasis palette, not a categorical one: the measured series wears Miles Green and
  any reference series is deliberately recessive gray. Where four measures must be compared
  (wellbeing) it faceted into small multiples rather than inventing three more hues. Never a
  dual-axis chart.

## Deployment

Vercel, pointed at `train.ironmiles.ie`. This app is not built by the repo's GitHub Pages workflow —
that only watches root `*.html`, `assets/**` and `reviews/**`, so the marketing site is unaffected.

---

## Not done yet

Named honestly rather than left to be discovered:

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
- **Demo data** is fictional, including the coach persona.
