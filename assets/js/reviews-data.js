/* ============================================================
   IRON MILES — review registry (structured data layer)
   Zero dependencies. Loaded by the reviews hub and every review page.

   THIS FILE IS THE SOURCE OF TRUTH for review *state*:
     · status        — 'published' | 'draft'  (flip this to publish)
     · rating        — null until a real score is entered
     · affiliateUrl  — null until a real affiliate link exists
     · needsInput    — what Andrew still has to supply

   Body copy for a published review lives in that review's HTML page
   (so it is crawlable with no JS). Everything that controls how a
   review is *presented* lives here. See REVIEWS.md.
   ============================================================ */
(function (root) {
  "use strict";

  /* Standard disclosure — reused by every review. Do not reword per-page. */
  var DISCLOSURE =
    "This review is based on genuine personal use. If an affiliate link is added, " +
    "Iron Miles may receive a commission from qualifying purchases at no additional " +
    "cost to you. Commercial relationships do not determine our verdicts.";

  var ANDREW = {
    name: "Andrew McNamara",
    role: "Founder, Iron Miles",
    bio:
      "Strength athlete turned endurance runner. Came to running at around 100 kg " +
      "and kept going — half marathon, the Great Limerick Marathon, and the 63 km " +
      "Connemara Ultra. Coaches and runs with the Iron Miles Club in Limerick.",
    image: "assets/images/andrew-iron-miles.jpg",
    imageAlt: "Andrew McNamara, founder of Iron Miles"
  };

  /* Category scaffold — hub filters render from this.
     Add future categories here; a category with no published reviews
     is rendered as a disabled "coming soon" chip, never a dead control. */
  var CATEGORIES = [
    { id: "all", label: "All reviews" },
    { id: "shoes", label: "Shoes" },
    { id: "watches", label: "Watches" },
    { id: "headphones", label: "Headphones" },
    { id: "cycling", label: "Cycling" },
    { id: "nutrition", label: "Nutrition" },
    { id: "recovery", label: "Recovery" }
  ];

  var REVIEWS = [
    /* ---------------------------------------------------------- */
    {
      slug: "nike-zoom-fly-6",
      url: "nike-zoom-fly-6/",
      productName: "Nike Zoom Fly 6",
      brand: "Nike",
      category: "shoes",
      categoryLabel: "Road / race shoe",
      status: "published",

      /* Hero uses an authentic Iron Miles photograph from the repo.
         A dedicated product photograph slot is listed in needsImages. */
      heroImage: "assets/images/andrew-connemara-ultra.jpg",
      imageAlt:
        "Andrew McNamara running the 63 km Connemara Ultra in the Nike Zoom Fly 6",
      heroWidth: 940,
      heroHeight: 940,

      shortVerdict:
        "The shoe I learned to run long in. A half marathon, a road marathon and " +
        "63 km of Connemara — and not one blister.",

      author: ANDREW,
      publishedDate: "2026-08-23",
      updatedDate: "2026-08-23",

      /* Only what is confirmed. Cumulative mileage was never logged, so it
         stays null rather than being invented — see needsInput. */
      testedDistance: null,
      testedEvents: [
        "First half marathon",
        "Great Limerick Marathon",
        "Connemara Ultra — 63 km"
      ],
      runnerWeight: "~100 kg",
      useCases: ["Long runs", "Road marathon", "Ultra distance", "First serious running shoe"],

      pros: [
        "Carried a half marathon, a full marathon and a 63 km ultra without a single blister",
        "Held up under a runner at around 100 kg — not a lightweight-only shoe",
        "Approachable enough to be a genuine first serious running shoe",
        "Same shoe handled short sessions and race day, so there was nothing to re-learn"
      ],
      considerations: [
        "A plated shoe is a big first purchase — it is not the cheapest way into running",
        "Andrew has not tested it in a direct back-to-back against other plated trainers",
        "Long-term outsole wear beyond the events listed has not been formally tracked"
      ],

      /* Section nav is generated from this list; ids match the page headings. */
      sections: [
        { id: "beyond-marketing", label: "Tested beyond the marketing" },
        { id: "background", label: "Andrew's background" },
        { id: "first-impressions", label: "First impressions" },
        { id: "fit", label: "Fit and comfort" },
        { id: "short-sessions", label: "Shorter sessions" },
        { id: "long-runs", label: "Long-run performance" },
        { id: "marathon", label: "Great Limerick Marathon" },
        { id: "ultra", label: "63 km Connemara Ultra" },
        { id: "heavier-runner", label: "Stability for a heavier runner" },
        { id: "what-worked", label: "What worked" },
        { id: "limitations", label: "Possible limitations" },
        { id: "who-for", label: "Who it may suit" },
        { id: "verdict", label: "Final verdict" }
      ],

      finalVerdict:
        "For a strength athlete moving into endurance, the Zoom Fly 6 did the one " +
        "thing that matters most: it got me to the finish of everything I entered, " +
        "comfortably, without my feet falling apart.",

      /* No numeric score has been given. Leave null — the rating component
         does not render at all unless a real number is entered here. */
      rating: null,

      /* No affiliate relationship exists. While this is null the CTA renders
         as a neutral, non-linked "View current product information". */
      affiliateUrl: null,
      affiliateDisclosure: DISCLOSURE,

      /* Specs: Nike's own domains are blocked from our build environment, so
         these could not be read directly off an official Nike product page.
         They are held here UNVERIFIED and are not printed on the page while
         verified === false. Confirm on nike.com, then set verified: true. */
      specs: {
        verified: false,
        source: "Search results citing official Nike pages — needs direct confirmation on nike.com",
        items: [
          { label: "Midsole foam", value: "ZoomX" },
          { label: "Plate", value: "Full-length carbon fibre Flyplate" },
          { label: "Weight", value: "Approx. 265 g / 9.3 oz (men's US 10)" },
          { label: "Vs. Zoom Fly 5", value: "Around 10% lighter" }
        ],
        notStated: ["Stack height (mm)", "Heel-to-toe drop"]
      },

      needsInput: [
        "Approximate total mileage run in the shoe (or 'never counted' — that is a fine answer)",
        "Your usual size vs. the size you took in this shoe",
        "Whether you would buy the same shoe again today",
        "Anything you noticed about outsole wear after Connemara"
      ],
      /* Supplied: outsole wear + upper detail (from Andrew's own clips, Aug 2026). */
      images: [
        "assets/images/nike-zoom-fly-6-outsole-wear.webp",
        "assets/images/nike-zoom-fly-6-upper-detail.webp"
      ],
      needsImages: [
        "Zoom Fly 6 product photograph (clean side-on, dark background)",
        "Andrew wearing or holding the Zoom Fly 6",
        "Great Limerick Marathon photograph"
      ]
    },

    /* ---------------------------------------------------------- */
    {
      slug: "nike-vomero-premium",
      url: "nike-vomero-premium/",
      productName: "Nike Vomero Premium",
      brand: "Nike",
      category: "shoes",
      categoryLabel: "Road / daily trainer",
      status: "draft",

      /* Product photographs of Andrew's own pair (supplied Aug 2026). These are
         descriptive product shots only — they carry no performance claim. */
      heroImage: "assets/images/nike-vomero-premium.webp",
      imageAlt:
        "A pair of Nike Vomero Premium running shoes in coral with a translucent blue midsole",
      heroWidth: 1050,
      heroHeight: 1400,
      images: [
        "assets/images/nike-vomero-premium.webp",
        "assets/images/nike-vomero-premium-heel.webp",
        "assets/images/nike-vomero-premium-top.webp"
      ],

      /* No verdict has been given. Nothing is invented here. */
      shortVerdict: null,

      author: ANDREW,
      publishedDate: null,
      updatedDate: null,

      testedDistance: null,
      testedEvents: [],
      runnerWeight: "~100 kg",
      useCases: [],

      pros: [],
      considerations: [],
      sections: [],
      finalVerdict: null,
      rating: null,

      affiliateUrl: null,
      affiliateDisclosure: DISCLOSURE,

      specs: { verified: false, source: null, items: [], notStated: [] },

      /* Shown only in the local/dev draft panel — never in production. */
      draftNote:
        "Andrew has bought and is running in the Vomero Premium. Long-term feedback " +
        "has not been supplied yet, so no verdict, rating or performance claim is published.",
      needsInput: [
        "First impressions out of the box",
        "Fit and sizing vs. the Zoom Fly 6",
        "What you are using them for (easy miles, recovery, daily trainer, walking)",
        "How they feel at 100 kg over an hour-plus",
        "Any comparison you want drawn against the Zoom Fly 6",
        "Your final verdict, and a score out of 10 only if you want one shown"
      ],
      needsImages: [
        "Andrew wearing / running in the Vomero Premium",
        "Outsole and upper detail shots once there are real miles on them"
      ]
    }
  ];

  /* ---- tiny read API used by the hub, review pages and JSON-LD ---- */
  var API = {
    disclosure: DISCLOSURE,
    author: ANDREW,
    categories: CATEGORIES,
    all: REVIEWS,
    published: function () {
      return REVIEWS.filter(function (r) { return r.status === "published"; });
    },
    bySlug: function (slug) {
      for (var i = 0; i < REVIEWS.length; i++) {
        if (REVIEWS[i].slug === slug) return REVIEWS[i];
      }
      return null;
    },
    /* A category is "live" only if it has at least one published review. */
    isCategoryLive: function (id) {
      if (id === "all") return true;
      return REVIEWS.some(function (r) {
        return r.category === id && r.status === "published";
      });
    }
  };

  root.IronReviews = API;
})(window);
