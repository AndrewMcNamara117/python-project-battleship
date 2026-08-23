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
        "My first serious running shoe — and the shoe that carried me from a first half " +
        "marathon to a full marathon and through the 63 km Connemara Ultra. Across all " +
        "three distances, I never developed a blister.",

      author: ANDREW,
      publishedDate: "2026-08-23",
      updatedDate: "2026-08-23",

      /* Only what is confirmed. Cumulative mileage was never logged, so it
         stays null rather than being invented. */
      testedDistance: null,
      purchasedPersonally: true,
      brandRelationship: "None at the time of review",
      testedEvents: [
        "First half marathon",
        "Great Limerick Marathon",
        "Connemara Ultra — 63 km"
      ],
      runnerWeight: "~100 kg",
      useCases: ["Long runs", "Road marathon", "Ultra distance", "First serious running shoe"],

      pros: [
        "Comfortable across half-marathon, marathon and ultramarathon distances",
        "No blisters during any of my three major events",
        "Performance-focused construction without being restricted to short races",
        "Suitable for both training and race-day use in my experience",
        "Responsive platform combining ZoomX foam and a carbon-fibre plate",
        "Gave me confidence as my distances progressed",
        "Proved that a 100 kg runner can benefit from performance-oriented footwear"
      ],
      considerations: [
        "My experience does not guarantee the same fit for every runner",
        "Foot shape, lacing, socks and race preparation affect blister outcomes",
        "Runners should build into plated footwear gradually",
        "A carbon plate cannot replace appropriate conditioning or sensible progression",
        "This is a road shoe, not a technical trail-running shoe",
        "No exact durability figure — verified total mileage was not recorded",
        "Runners with injury concerns should choose footwear on individual assessment"
      ],

      /* Section nav is generated from this list; ids match the page headings. */
      sections: [
        { id: "testing-summary", label: "Testing summary" },
        { id: "technical", label: "Technical overview" },
        { id: "background", label: "Strength athlete to endurance runner" },
        { id: "first-impressions", label: "First impressions" },
        { id: "the-ride", label: "The ride" },
        { id: "fit", label: "Fit, comfort and blisters" },
        { id: "half-marathon", label: "First half marathon" },
        { id: "marathon", label: "Great Limerick Marathon" },
        { id: "ultra", label: "Connemara Ultra 63 km" },
        { id: "heavier-runner", label: "Performance for a 100 kg runner" },
        { id: "what-i-liked", label: "What I liked" },
        { id: "considerations", label: "Important considerations" },
        { id: "who-for", label: "Who is it for?" },
        { id: "who-else", label: "Who may need something different?" },
        { id: "verdict", label: "Final verdict" }
      ],

      finalVerdict:
        "For this approximately 100 kg runner, the Nike Zoom Fly 6 proved comfortable, " +
        "versatile and capable of going far beyond the distance I originally imagined I " +
        "could run. It wasn't just my first serious running shoe. It was the shoe that " +
        "came with me while I became a runner.",

      /* No numeric score has been given. Leave null — the rating component
         does not render at all unless a real number is entered here. */
      rating: null,

      /* No affiliate relationship exists. While this is null the CTA renders
         as a neutral, non-linked "View current product information". */
      affiliateUrl: null,
      affiliateDisclosure: DISCLOSURE,

      /* Specs are stated in the page prose, explicitly attributed to Nike, as
         supplied by Andrew. They are NOT auto-rendered as a spec table here:
         Nike's domains are blocked from our build environment, so the 8 mm drop
         could not be confirmed against an official page. The ~265 g figure does
         corroborate what official Nike pages state for men's US 10 (= UK 9).
         Set verified: true once the drop is confirmed on nike.com. */
      specs: {
        verified: false,
        source: "Supplied by Andrew, attributed to Nike; drop not independently confirmed",
        items: [
          { label: "Midsole foam", value: "ZoomX" },
          { label: "Plate", value: "Full-length carbon-fibre Flyplate" },
          { label: "Weight", value: "Approx. 265 g (men's UK 9)" },
          { label: "Heel-to-toe drop", value: "8 mm" }
        ],
        notStated: []
      },

      needsInput: [
        "Confirm the 8 mm heel-to-toe drop against Nike's own product page, then set specs.verified",
        "Your usual size vs. the size you took in this shoe (optional — the review states fit is individual)",
        "A score out of 10, only if you ever want one displayed"
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
