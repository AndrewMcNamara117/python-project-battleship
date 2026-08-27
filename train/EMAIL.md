# Email delivery

Iron Miles sends two kinds of email to coaches, and nothing else. Both come
from the same roster signals the coach's own screen renders from — there is no
separate "email logic" that could disagree with what they see when they log in.

| | |
|---|---|
| **Daily digest** | One a day, at the coach's own local hour. Skipped entirely when nothing needs them. |
| **Urgent alert** | A flagged check-in, or an athlete reporting pain with a high soreness score. Nothing else interrupts anyone. |

There is no marketing email, no newsletter, and no engagement email. If a
message would not change what a coach does, it is not sent.

---

## What you need to do

Three steps. After step 1 the product sends real email to one address; after
step 3 it sends to coaches.

### 1. Create a Resend account — 5 minutes

Sign up at **https://resend.com** and **register the account with
`ironmilesclub@outlook.com`**. That matters: Resend's built-in sender
(`onboarding@resend.dev`) is only allowed to deliver to the address the account
itself was registered with, so registering with the Iron Miles mailbox is what
makes the test send below work without touching DNS.

Then **API Keys → Create API Key**, and set:

```
RESEND_API_KEY=re_...
EMAIL_TEST_RECIPIENT=ironmilesclub@outlook.com
```

### 2. Prove it — 1 minute

```bash
curl -X POST -H "authorization: Bearer $CRON_SECRET" \
  "https://train.ironmiles.ie/api/admin/email-test?which=both"
```

Two emails arrive at `ironmilesclub@outlook.com`: one digest, one alert, both
subject-prefixed `[TEST]` and both built from invented names. The response
tells you the provider, the exact From and Reply-To used, whether the sender is
verified, and what the provider said.

That endpoint can only ever send to `EMAIL_TEST_RECIPIENT`. It takes no `to`
parameter, so it cannot be pointed at a coach, an athlete, or a list.

### 3. Verify a domain, to email actual coaches — 30 minutes, mostly waiting

Until this is done, Resend will only deliver to the account's own address.

1. Resend → **Domains → Add Domain** → `ironmiles.ie`
2. Publish the DNS records it gives you (an SPF `TXT`, a DKIM `TXT`, and a
   return-path `CNAME` or `MX`) wherever `ironmiles.ie` DNS is managed.
3. Wait for the domain to show **Verified**.
4. Set:

```
EMAIL_FROM_ADDRESS=training@ironmiles.ie
EMAIL_FROM_NAME=Iron Miles Training
EMAIL_FROM_VERIFIED=true
```

Nothing else in the application changes.

### Optional: delivery receipts

Resend → **Webhooks** → add `https://train.ironmiles.ie/api/webhooks/resend`,
subscribe to `email.delivered`, `email.bounced` and `email.complained`, and set
`RESEND_WEBHOOK_SECRET=whsec_...`.

Without this, deliveries stop honestly at **sent** — the provider accepted the
message — and never claim **delivered**.

---

## Why `From:` is not `ironmilesclub@outlook.com`

No transactional email provider will send as an address on a domain you have
not verified by DNS, and nobody can add DNS records to `outlook.com`. Resend,
Postmark and SES all refuse this identically; it is not a Resend limitation.

So the Iron Miles mailbox is used as **Reply-To**, which needs no verification.
A coach hitting reply reaches `ironmilesclub@outlook.com` exactly as intended.
The `From:` address is Resend's test sender until `ironmiles.ie` is verified,
and `sender().verified` reports `false` until you say otherwise — the settings
screen and the test-send response both show it rather than claiming a sender
that would bounce.

---

## Scheduling

Three endpoints, all authorised by `CRON_SECRET` as a bearer token, all
idempotent and restart-safe. Re-running any of them sends nothing twice.

```
*/15 * * * *   /api/cron/coach-alerts
0    * * * *   /api/cron/coach-digest
*/5  * * * *   /api/cron/notification-delivery
```

The digest job runs **hourly, not daily**, and decides per coach whether their
own local hour has arrived. A coach in Limerick and a coach in Sydney have
different mornings, and clocks change twice a year; the job reads each coach's
IANA timezone through `Intl` rather than storing an offset.

On Vercel this is `vercel.json` → `crons`. Anything that can send a scheduled
HTTP request with a header works just as well.

---

## What a delivery record means

| State | Means |
|---|---|
| `pending` | Written, not yet attempted — or held until quiet hours end. |
| `sent` | The provider accepted it. **Not** evidence it reached anyone. |
| `delivered` | A provider webhook confirmed it reached the mailbox. |
| `failed` | Attempted, failed, and queued for another go. |
| `failed_permanent` | Will never succeed, or the retries are exhausted. Still on the record. |
| `unavailable` | No provider configured. Nothing went wrong; nothing was possible. |

Retries run at 1 minute, 5 minutes, then 30 minutes, and stop after four
attempts in total. A rejected address or an unverified sender is not retried at
all — it would fail identically every time, and four goes at it would bury the
reason. Nothing is ever silently dropped: a give-up leaves the row in place
with the last failure on it.

---

## What is never in an email

Emails render from a notification's structured payload, never from its body.
The in-app card quotes the athlete's own words because it sits behind a login;
an email sits in a preview pane on a desk anyone can walk past, so it carries
the *kind* of signal and nothing else.

- **Never**: what an athlete wrote, a soreness score, a body part, a check-in
  answer, a coach note.
- **Subjects** carry a shortened name — `Aoife D.` — and what needs doing.
- **Bodies** say what was raised and link into Iron Miles for the rest.

A notification with no payload is refused rather than rendered from its body.
The coach still has it in Iron Miles; nothing private leaves the building.

Every link is a destination, never a credential. The page it lands on
re-checks the roster, so a forwarded email grants nobody anything.

---

## Demo mode

With no `RESEND_API_KEY` and no database, email is **simulated**: the message
is composed and logged, the delivery is recorded as `sent` with the detail
`DEMO — email delivery simulated. Nothing was sent.`, and the message id is
prefixed `demo_` so it can never be mistaken for a provider's. The settings
screen labels the channel *Simulated*.

With a real database and no key, email is `unavailable` and the settings screen
says so rather than offering a switch that does nothing.
