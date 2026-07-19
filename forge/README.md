# THE FORGE — Iron Miles Member Hub

The Firebase-powered member hub for [Iron Miles](https://ironmiles.ie), Limerick.
Join the community, RSVP to sessions, log daily **Forge One More** moments,
apply for coaching — with an admin view over all of it.

Zero-build static site: plain HTML/CSS/JS + the Firebase Web SDK loaded from
Google's CDN. No bundler, no framework, no npm dependencies for the app itself.

## Pages

| Route (hosted) | File | What it does |
|---|---|---|
| `/` | `index.html` | Hub landing — hero, what/how, session preview, announcements |
| `/join` | `join.html` | Member sign-up form → `members` |
| `/sessions` | `sessions.html` | Session cards + "I'm Showing Up" RSVP → `eventSignups` |
| `/check-in` | `check-in.html` | Daily Forge Log + streak stats → `forgeCheckins` |
| `/coaching-apply` | `coaching-apply.html` | Coaching application → `coachingApplications` |
| `/dashboard` | `dashboard.html` | Member dashboard (login required) |
| `/admin` | `admin.html` | Admin dashboard (admin email required) |
| `/login`, `/register` | `login.html`, `register.html` | Email/password auth |

`cleanUrls` is enabled in `firebase.json`, so `/join` and `join.html` both work
on Firebase Hosting. Internal links use `.html` so the site also works on any
plain static server.

## Firestore collections

- `members` — member profiles (doc id = uid for signed-in members)
- `sessions` — sessions created in `/admin` (`isActive` controls visibility)
- `eventSignups` — RSVPs (`status: "going"`, `uid` optional)
- `forgeCheckins` — daily logs (`uid` optional, `dateKey` = YYYY-MM-DD)
- `coachingApplications` — applications (`status: "new"` → `"read"`)
- `announcements` — admin notices (`visible` controls the hub banner)

## Setup

### 1. Install the Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

(That's the only install — the app itself has no dependencies.)

### 2. Create a Firebase project

1. Go to <https://console.firebase.google.com> → **Add project** (e.g. `iron-miles-forge`).
2. In the project, click the **Web** icon (`</>`) to register a web app.
3. Copy the `firebaseConfig` object it shows you.

### 3. Enable Authentication

Console → **Build → Authentication → Get started → Sign-in method** →
enable **Email/Password**.

### 4. Enable Firestore

Console → **Build → Firestore Database → Create database** →
**Production mode** → pick `europe-west1` (or `europe-west2`) for Ireland.

### 5. Add your Firebase config

Open `assets/js/firebase-config.js` and replace the placeholder values with
the config from step 2. In the same file, put your real email into
`ADMIN_EMAILS`. Then put the **same email** into the `isAdmin()` list in
`firestore.rules` — the rules are what actually protect the data.

Also set your project id in `.firebaserc`.

> **On env vars:** this is a zero-build site, so there's no bundler to inject
> environment variables. Firebase web config values are public identifiers,
> not secrets — security lives in `firestore.rules`. If you later adopt a
> bundler (e.g. Vite), move the config to `import.meta.env.VITE_*` variables.

### 6. Deploy the security rules

```bash
cd forge
firebase deploy --only firestore:rules
```

## Run locally

```bash
cd forge
firebase emulators:start --only hosting   # http://localhost:5000, real Firebase backend
# or, without the Firebase CLI:
python3 -m http.server 8080               # http://localhost:8080 (use .html URLs)
```

For fully offline dev, `firebase emulators:start` also runs Auth/Firestore
emulators (the app connects to production Firebase by default; wiring the
emulators in would be a small change in `forge-core.js`).

## Deploy to Firebase Hosting

```bash
cd forge
firebase deploy
```

You get `https://YOUR_PROJECT_ID.web.app`. To serve it on a subdomain like
`forge.ironmiles.ie`: Console → **Hosting → Add custom domain** and follow the
DNS steps.

## Admin dashboard

Register an account at `/register` **using an email in `ADMIN_EMAILS`** (and in
`firestore.rules`), then **click the verification link** the app emails you —
the rules require a verified admin email, so nobody can claim your address by
registering it first. The `/admin` page offers a resend button if needed.
The Admin link then appears in the nav. From `/admin` you
can view members, RSVPs, Forge Logs and coaching applications, create/edit/
delete sessions, and publish announcements.

The built-in sample session (**First Iron Miles Run Club** — Saturday 10:00am,
UL Living Bridge) only appears while the backend is unreachable (e.g. Firebase
not configured yet). Once connected, an empty sessions collection shows an
honest "nothing on the board" state — never a phantom event people might show
up for. RSVPs to the sample are stored with `eventId: "sample-first-run-club"`.
Password resets are self-service via "Forgot your password?" on `/login`.

## What you still need to update manually

1. `assets/js/firebase-config.js` — real Firebase config + your admin email.
2. `firestore.rules` — the same admin email, then redeploy rules.
3. `.firebaserc` — your project id.
4. Footer/waiver/privacy links point at `ironmiles.ie/privacy.html` and
   `waiver.html` — those pages are templates that still need solicitor review
   before you rely on them.

## Hardening before public launch

- **TODO — real admin roles:** the email allow-list works but is crude. Move to
  Firebase **custom claims**: a tiny Node script (or Cloud Function) calls
  `admin.auth().setCustomUserClaims(uid, { admin: true })`, then rules become
  `request.auth.token.admin == true` and no email list lives in code.
- **Public create endpoints** (`members`, `eventSignups`, `forgeCheckins`,
  `coachingApplications`) are open by design so people can act without an
  account. The rules already enforce field allow-lists and size limits per
  document; before launch, also enable **App Check** (reCAPTCHA v3) to keep
  bots out.
- **Medical notes / emergency contacts** are personal data — keep the privacy
  notice accurate (GDPR), and delete member docs on request.
- **Email notifications** (e.g. new coaching application → your inbox) need a
  Cloud Function + an email provider; not included in this version.
- **Streaks for guests** are stored in `localStorage` only — accurate streaks
  require an account, which the UI already nudges people toward.
