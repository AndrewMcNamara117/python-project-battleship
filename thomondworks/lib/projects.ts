export type ProjectStatus = "live" | "concept";

export interface ProjectImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface Project {
  slug: string;
  title: string;
  category: string;
  year: string;
  status: ProjectStatus;
  /** One-line description used on cards. Factual — no invented results. */
  summary: string;
  services: string[];
  /** Accent used in the project's art direction. */
  accent: string;
  /** Cover photograph, when real imagery exists. */
  cover?: ProjectImage;
  intro: string;
  body: string[];
  gallery?: ProjectImage[];
  /** Brand line, if the identity has one. */
  brandLine?: string;
  externalUrl?: string;
}

export const projects: Project[] = [
  {
    slug: "iron-miles",
    title: "Iron Miles",
    category: "Endurance & Community Brand",
    year: "2025",
    status: "live",
    summary:
      "A Limerick-born endurance and community brand — identity, website and digital presence built around one idea: forge one more.",
    services: [
      "Brand Identity",
      "Web Design & Development",
      "Motion Design",
      "Art Direction",
    ],
    accent: "#2dff8a",
    brandLine: "FORGE ONE MORE.",
    cover: {
      src: "/images/iron-miles/runner-mid-stride-at-dawn.jpg",
      alt: "Iron Miles athlete running at dawn on an open road",
      width: 1200,
      height: 800,
    },
    intro:
      "Iron Miles is a Limerick-born endurance and community brand, built around a simple belief: there is always one more mile, one more rep, one more opportunity to move forward.",
    body: [
      "The brand needed to feel earned rather than styled — black as the default state, a single mint-green accent used the way a head-torch cuts through a dark road, and typography heavy enough to carry a shout.",
      "We designed the identity system, then built an immersive website with zero third-party dependencies: a WebGL particle hero that assembles the Iron Miles mark, scroll-driven storytelling, per-character text reveals and a motion system that collapses gracefully for reduced-motion users.",
      "The same system extends across the run club, coaching, events and apparel — one voice from the website to the finisher medal.",
    ],
    gallery: [
      {
        src: "/images/iron-miles/iron-miles-preview.jpg",
        alt: "Iron Miles brand mark on a black background",
        width: 1200,
        height: 630,
      },
      {
        src: "/images/iron-miles/built-in-the-dark-headtorch-runner-in-the-wo.webp",
        alt: "Head-torch runner in the woods at night — Iron Miles campaign image",
        width: 1200,
        height: 800,
      },
      {
        src: "/images/iron-miles/strength-session.jpg",
        alt: "Strength and conditioning session at an Iron Miles training block",
        width: 1200,
        height: 800,
      },
      {
        src: "/images/iron-miles/open-water-training-at-dawn.jpg",
        alt: "Open-water swim training at first light",
        width: 1200,
        height: 800,
      },
      {
        src: "/images/iron-miles/forge-one-more-iron-miles-finisher-medal.webp",
        alt: "Forge One More — Iron Miles finisher medal",
        width: 1200,
        height: 800,
      },
    ],
  },
  {
    slug: "the-strand-house",
    title: "The Strand House",
    category: "Hospitality — Concept Study",
    year: "2026",
    status: "concept",
    summary:
      "A design study for a riverside guesthouse: quiet luxury, warm stone tones and a booking journey that stays out of the way.",
    services: ["Web Design", "Brand Identity", "Digital Strategy"],
    accent: "#c3a67c",
    intro:
      "A self-initiated concept study exploring how a premium Shannon-side guesthouse could present itself online — calm, warm and confident, without a single stock photograph of a lobby.",
    body: [
      "The study works through an editorial layout system built on oversized serif type, generous whitespace and a bronze-on-charcoal palette drawn from Limerick stone at dusk.",
      "Interaction design focuses on the booking journey: fewer steps, clearer states, and motion used only to confirm progress — never to decorate it.",
      "Concept work is labelled as such. Nothing here is presented as a shipped client engagement.",
    ],
  },
  {
    slug: "treaty-strength",
    title: "Treaty Strength",
    category: "Fitness — Concept Study",
    year: "2026",
    status: "concept",
    summary:
      "A concept identity for a strength club on the north side of the city — industrial, disciplined and unmistakably local.",
    services: ["Brand Identity", "Web Design", "SEO & Performance"],
    accent: "#25b57e",
    intro:
      "A concept exploring how a neighbourhood strength club could look bigger than its square footage — a compact identity system built from stencil-cut type, structural lines and a restrained emerald accent.",
    body: [
      "The digital concept pairs a fast, single-page site with a timetable-first information architecture: opening hours, programming and pricing within one scroll on a phone.",
      "Performance is the design constraint — system fonts, no framework overhead, and imagery treated as duotone so it compresses beautifully.",
      "Concept work is labelled as such. Nothing here is presented as a shipped client engagement.",
    ],
  },
  {
    slug: "occonnell-hayes",
    title: "O'Connell & Hayes",
    category: "Professional Services — Concept Study",
    year: "2026",
    status: "concept",
    summary:
      "A concept for a modern Irish advisory firm: architectural typography, document-grade clarity and zero corporate clichés.",
    services: ["Brand Identity", "Web Design", "Website Care"],
    accent: "#f2f0ed",
    intro:
      "A study in how a professional-services firm can feel authoritative without the usual glass towers and handshake photography — type-led, document-inspired and quietly confident.",
    body: [
      "The concept borrows its grid from legal documents: ruled hairlines, numbered clauses, and a strict two-column rhythm that adapts cleanly to mobile.",
      "Motion is nearly absent by design; the premium feel comes from spacing, hierarchy and typographic detail rather than animation.",
      "Concept work is labelled as such. Nothing here is presented as a shipped client engagement.",
    ],
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
