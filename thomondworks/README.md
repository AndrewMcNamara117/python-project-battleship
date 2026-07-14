# Thomond Works

Premium agency website for **Thomond Works** — an independent digital studio in
Limerick, Ireland. *Built in Limerick. Made for everywhere.*

Next.js (App Router) + TypeScript + Tailwind CSS 4 + GSAP/ScrollTrigger + Lenis.

## Commands

```bash
npm install
npm run dev      # local development
npm run lint     # ESLint
npm run build    # production build (all routes prerender statically)
npm start        # serve the production build
```

## Architecture

- **`lib/`** — typed content data (projects, journal articles, services, site
  config), structured so it can later be swapped for a CMS (Sanity, Payload,
  etc.) without touching page components.
- **`components/MotionProvider.tsx`** — the motion engine. Lenis smooth scroll
  plus a data-attribute-driven GSAP layer (`data-split`, `data-reveal`,
  `data-img-reveal`, `data-parallax`, `data-draw`, `data-magnetic`,
  `data-hero-settle`), so pages stay server components. All triggers are
  reverted on route change via `gsap.context`.
- **`components/IntroLoader.tsx`** — first-visit logo assembly animation.
  Gated by an inline script in `app/layout.tsx` that runs before paint:
  once per session (`sessionStorage`), skipped entirely for
  `prefers-reduced-motion` and no-JS visitors.
- **`components/Logo.tsx`** — the SVG bridge-mark system (brand / mono /
  white / emerald / bronze variants, horizontal + stacked lockups).
- Design tokens live in `app/globals.css` (`@theme` colours, fluid type
  scale, motion easings/durations, z-index scale).

## Accessibility & motion

Every animation collapses to static, fully readable content under
`prefers-reduced-motion`. Skip link, focus-visible styles, aria-labels on
split text, keyboard-operable menu and cursor-independent interactions
throughout.

## Content honesty

No fabricated metrics, awards or testimonials. Concept portfolio pieces are
labelled "Concept Study"; the testimonial slot and legal pages are explicit
placeholders pending real data / solicitor review.

## Deployment

Standard Node/Vercel deployment works as-is. For fully static hosting, add
`output: "export"` to `next.config.ts` (images are already unoptimised and
every route prerenders).
