# Iron Miles Reviews — how the system works

The reviews section lives at `/reviews/` and is built the same way as the rest of the site:
plain static HTML, zero dependencies, no build step. It adds three files to the shared asset
layer and one directory per review.

```
assets/js/reviews-data.js      the review registry  ← source of truth for review STATE
assets/js/reviews.js           behaviour (status gating, filters, scrollspy, analytics hook)
assets/css/reviews.css         the 13 review components (all prefixed .rv-)
reviews/index.html             the hub            → /reviews/
reviews/<slug>/index.html      one review page    → /reviews/<slug>/
```

## Where content lives, and why

| Thing | Lives in | Reason |
|---|---|---|
| Review body copy | the review's `index.html` | crawlable with no JS — best SEO, no layout shift |
| Status, rating, affiliate URL, specs, needed input | `reviews-data.js` | publishing is a one-word change, not an HTML edit |
| Card presentation state (badge, CTA wording, filters) | `reviews-data.js` → applied by `reviews.js` | flipping `status` genuinely changes what visitors see |

## The schema

Every entry in `reviews-data.js` carries these fields:

```
slug  productName  brand  category  categoryLabel  status
heroImage  imageAlt  heroWidth  heroHeight
shortVerdict  author  publishedDate  updatedDate
testedDistance  testedEvents  runnerWeight  useCases
pros  considerations  sections  finalVerdict
rating  affiliateUrl  affiliateDisclosure
specs { verified, source, items[], notStated[] }
needsInput[]  needsImages[]  draftNote
```

Anything not confirmed is `null` or `[]` — never a placeholder string, never invented.

## The three gates

These are enforced in `reviews.js` so a half-finished review can't leak:

1. **`status: 'draft'`** — the hub card shows *"Full long-term review coming soon"* and stops
   being a link in production. Draft pages also carry `<meta name="robots" content="noindex,follow">`.
2. **`rating: null`** — the rating component is removed entirely. No stars, no fake score.
   A number only appears when a real one is entered.
3. **`affiliateUrl: null`** — the CTA renders as a neutral, non-clickable
   *"View current product information"*. It only becomes a real link (with `rel="sponsored noopener"`)
   once a valid `https://` URL is set.

A fourth gate covers specs: `specs.verified: false` means the specs table is not rendered at all.
Unverified specs are never written into the HTML, so they can't leak even with JS blocked.

## Publishing a draft review

1. Fill in the section content in `reviews/<slug>/index.html`.
2. In `reviews-data.js`, set `status: 'published'` and fill `shortVerdict`, `pros`,
   `considerations`, `finalVerdict`, `publishedDate`.
3. Delete the `<meta name="robots" content="noindex,follow">` tag from that page.
4. Add the `Article` JSON-LD block (copy the one in `nike-zoom-fly-6/index.html`).
5. Optional: set `rating` only if a real score is being given.

## Adding a new review

1. Add an entry to `REVIEWS` in `reviews-data.js` (copy an existing one, change the fields).
2. `cp -r reviews/nike-zoom-fly-6 reviews/<new-slug>` and rewrite the content.
3. Update `data-review-slug` on `<body>`, the `<title>`, meta description, canonical, OG tags,
   breadcrumb JSON-LD and the section-nav list.
4. Add a card to `reviews/index.html` — copy an existing `.rv-card` block and set `data-slug`.
5. If it is a new category, add it to `CATEGORIES` in `reviews-data.js`. Categories with no
   published reviews render as disabled chips, so there are never dead controls.

## The components

All 13 are in `reviews.css`, prefixed `.rv-` so they cannot collide with the existing system.
They use only the tokens already defined in `iron.css` — no new colours, no new fonts.

`.rv-hero` · `.rv-product` · `.rv-facts` · `.rv-pc` (pros/considerations) · `.rv-toc` ·
`.rv-pull` · `.rv-verdict` · `.rv-method` · `.rv-disclosure` · `.rv-cta` · `.rv-related` ·
`.rv-author` · `.rv-rating`

Plus `.rv-card` / `.rv-filters` for the hub, `.rv-crumbs` for breadcrumbs, and `.rv-panel`
as the shared forged surface.

## Analytics

The site ships **no analytics vendor**. Rather than adding one, `reviews.js` exposes a hook:

```js
imTrack('review_view',        { slug, product, status });
imTrack('product_link_click', { slug, product, brand });
imTrack('review_card_click',  { slug, product, status });
imTrack('review_filter',      { category });
```

`imTrack()` forwards to Plausible, `gtag` or `dataLayer` if any of them is ever added, and
always dispatches a DOM `im:track` event. It sends no personal data, sets no cookies, and
never throws. Until a provider is added it is a no-op.

## Dev mode

Draft material renders only on `localhost`, `127.0.0.1`, a `.local` host, or with `?draft=1`
in the URL. On ironmiles.ie the `rv-dev` class is never applied, so `.rv-draftbar` and
`.rv-draft-only` content stay hidden.

```bash
python3 -m http.server 8080     # then http://localhost:8080/reviews/
```

## Deployment note

`.github/workflows/pages.yml` filters on changed paths. `reviews/**` is in that list — if the
directory is ever renamed, update the workflow or new pages will not deploy.
