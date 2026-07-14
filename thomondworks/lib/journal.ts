export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string };

export interface Article {
  slug: string;
  title: string;
  category: string;
  date: string; // ISO
  readingMinutes: number;
  excerpt: string;
  body: ArticleBlock[];
}

export const articles: Article[] = [
  {
    slug: "what-makes-a-website-feel-premium",
    title: "What Makes a Website Feel Premium?",
    category: "Web Design",
    date: "2026-06-18",
    readingMinutes: 5,
    excerpt:
      "It isn't the animations. It's restraint, hierarchy, and a hundred small decisions most visitors will never consciously notice.",
    body: [
      {
        type: "p",
        text: "Ask most people what makes a website feel expensive and they'll point to the obvious things: big imagery, smooth animations, a dark colour scheme. Those can help, but none of them are the cause. Plenty of sites have all three and still feel cheap.",
      },
      { type: "h2", text: "Premium is mostly restraint" },
      {
        type: "p",
        text: "The strongest signal of quality is what a site chooses not to do. One typeface pairing instead of four. One accent colour, used sparingly. Whitespace that lets a headline breathe instead of a layout that fights for attention in every section. Restraint reads as confidence, and confidence reads as quality.",
      },
      { type: "h2", text: "Hierarchy does the heavy lifting" },
      {
        type: "p",
        text: "On a premium site you always know what to read first, what to read next, and what to do afterwards. That's typographic hierarchy — scale, weight, spacing and contrast working together. It's invisible when it's right and unmistakable when it's wrong.",
      },
      { type: "h2", text: "Speed is a design feature" },
      {
        type: "p",
        text: "Nothing undermines an expensive design faster than a slow first load or janky scrolling. Perceived quality is inseparable from performance: optimised images, minimal JavaScript, and animations that run on the compositor rather than the layout engine.",
      },
      {
        type: "p",
        text: "The summary: premium isn't a style you apply at the end. It's the accumulation of small, deliberate decisions — most of which a visitor will never consciously notice, all of which they will feel.",
      },
    ],
  },
  {
    slug: "why-most-small-business-websites-underperform",
    title: "Why Most Small Business Websites Underperform",
    category: "Digital Strategy",
    date: "2026-05-27",
    readingMinutes: 6,
    excerpt:
      "The usual culprit isn't design or technology. It's that nobody decided what the website is actually for.",
    body: [
      {
        type: "p",
        text: "Most small business websites were built to exist, not to work. Someone needed 'a website', a template was chosen, the about page was written in an afternoon, and the whole thing has sat largely untouched since.",
      },
      { type: "h2", text: "No defined job" },
      {
        type: "p",
        text: "A website that hasn't been given a job can't fail at it — which is exactly the problem. Should it generate enquiries? Bookings? Phone calls? Build enough trust that a referral converts? Each of those implies different content, structure and calls to action. Trying to do all of them equally usually means doing none of them well.",
      },
      { type: "h2", text: "Written from the inside out" },
      {
        type: "p",
        text: "Most underperforming sites talk about the business rather than to the customer. Visitors arrive with a problem; the site answers with a history lesson. Reversing that — leading with the visitor's problem and the outcome you provide — is the cheapest conversion improvement available.",
      },
      { type: "h2", text: "Invisible to search, slow to load" },
      {
        type: "p",
        text: "Technical neglect compounds quietly: missing metadata, no structured data, uncompressed images, hosting chosen on price alone. None of these are visible in a screenshot, and all of them decide whether the site is ever found in the first place.",
      },
      {
        type: "p",
        text: "The fix rarely starts with a redesign. It starts with a decision about what the website is for — then design, content and engineering can be pointed at that job.",
      },
    ],
  },
  {
    slug: "building-a-brand-that-looks-bigger-than-it-is",
    title: "Building a Brand That Looks Bigger Than It Is",
    category: "Branding",
    date: "2026-04-15",
    readingMinutes: 5,
    excerpt:
      "Small businesses don't need more assets. They need consistency — the one thing big brands are actually good at.",
    body: [
      {
        type: "p",
        text: "What makes a large company's brand feel large isn't the budget behind any single piece of design. It's that everything matches. The invoice, the van, the website and the email signature all clearly come from the same place.",
      },
      { type: "h2", text: "Consistency is the multiplier" },
      {
        type: "p",
        text: "A small business with one logo, one typeface pairing, one colour system and one tone of voice — applied everywhere without exception — will read as more established than a competitor ten times its size with a scattered identity.",
      },
      { type: "h2", text: "Decide once, then stop deciding" },
      {
        type: "p",
        text: "The practical tool is a small set of rules: how the logo sits, which colours are allowed, how photography is treated, how you write. Good brand guidelines aren't a corporate luxury; they're a way of never having to make the same design decision twice.",
      },
      { type: "h2", text: "Details carry the signal" },
      {
        type: "p",
        text: "Favicons, social previews, email templates, proposal documents — the places small businesses forget are exactly the places customers subconsciously check. Finishing the edges is what makes the whole feel considered.",
      },
      {
        type: "p",
        text: "You don't need a rebrand every two years. You need one strong identity, applied with discipline, for long enough that people start to recognise it.",
      },
    ],
  },
  {
    slug: "why-speed-matters-more-than-you-think",
    title: "Why Speed Matters More Than You Think",
    category: "Performance",
    date: "2026-03-09",
    readingMinutes: 4,
    excerpt:
      "Speed isn't a technical metric. It's the first impression, the bounce rate, and part of how Google decides who gets found.",
    body: [
      {
        type: "p",
        text: "Before a visitor reads a word of your carefully written homepage, they've already formed an opinion — during the load. A site that appears instantly feels competent. A site that stutters in feels neglected, whatever it looks like once it arrives.",
      },
      { type: "h2", text: "The compounding cost of slow" },
      {
        type: "p",
        text: "Slowness taxes everything downstream: more visitors bounce before the page renders, fewer pages get visited per session, and paid traffic converts worse — which quietly raises the effective cost of every ad click you buy.",
      },
      { type: "h2", text: "Search engines are watching too" },
      {
        type: "p",
        text: "Core Web Vitals — Google's measurements of loading, interactivity and visual stability — feed directly into ranking. Two businesses with similar content and authority can be separated in results by engineering quality alone.",
      },
      { type: "h2", text: "Where the weight actually is" },
      {
        type: "p",
        text: "In practice, most slow sites share the same three problems: images shipped at several times their display size, JavaScript loaded for features nobody uses, and fonts blocking the first paint. All three are fixable without redesigning anything.",
      },
      {
        type: "p",
        text: "Treat speed as a feature with an owner, a budget and a target — not as something to look at after launch.",
      },
    ],
  },
  {
    slug: "the-real-cost-of-a-cheap-website",
    title: "The Real Cost of a Cheap Website",
    category: "Limerick Business",
    date: "2026-02-02",
    readingMinutes: 5,
    excerpt:
      "The invoice is the smallest number involved. The real price is paid in lost enquiries, rebuilds, and years of looking smaller than you are.",
    body: [
      {
        type: "p",
        text: "A cheap website is rarely cheap. The invoice is just the most visible number — and usually the smallest one involved.",
      },
      { type: "h2", text: "The opportunity cost" },
      {
        type: "p",
        text: "A website that fails to convince costs you the enquiries that never happened. Those don't show up in any report; the customer simply chose the competitor whose site made them feel confident. For most service businesses, a single lost project a month dwarfs the money saved on the build.",
      },
      { type: "h2", text: "The rebuild cycle" },
      {
        type: "p",
        text: "Cheap builds get replaced, on average, far sooner — not because they break, but because they were never designed around the business in the first place. Two rebuilds later, the 'affordable' option has cost more than doing it properly once, and the brand has changed clothes three times in front of its customers.",
      },
      { type: "h2", text: "The credibility discount" },
      {
        type: "p",
        text: "For local businesses especially, the website is often the only thing a prospect sees between a recommendation and a phone call. A dated, slow or template-obvious site quietly discounts the referral before you ever get to speak.",
      },
      {
        type: "p",
        text: "None of this means every business needs a five-figure build. It means the right question isn't 'what does it cost?' but 'what is it for, and what does getting that wrong cost?'",
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
