/**
 * IRON MILES TRAINING — canonical design tokens.
 *
 * The single source of truth. `globals.css` mirrors these into CSS custom
 * properties for Tailwind; this module exists for the places CSS cannot reach —
 * chart configuration, SVG attributes, WebGL materials, canvas.
 *
 * Every value traces to the approved Digital Design System v1.0 board. Nothing
 * here was sampled from a screenshot, and nothing is a guess.
 *
 * Contrast is a property of the token, not of the component that uses it: each
 * ink value below records its measured ratio on Charcoal and what it is
 * therefore permitted to do. `inkFaint` fails AA for text at 3.4:1 and is
 * constrained to hairlines and disabled marks — that constraint is the reason
 * this file exists rather than colours being chosen by eye at each call site.
 */

/* ---------------- surfaces ---------------- */

export const SURFACE = {
  /** App ground. The deepest layer. */
  onyx: '#0B0B0B',
  /** Cards and panels. */
  charcoal: '#111418',
  /** Raised, active or selected surfaces. */
  slate: '#1A1F23',
  /** Inputs, borders, chart reference marks. */
  steel: '#2A2F35',
} as const;

/* ---------------- accent ---------------- */

export const ACCENT = {
  /** Iron Miles Mint. The one accent. Used sparingly, never as a fill at size. */
  mint: '#2DFF8A',
  /** Dimmed mint for secondary marks and gradient tails. */
  mintDim: '#1F9E5A',
  /** Text and icons sitting on top of mint. 14.3:1. */
  mintDeep: '#04130A',
} as const;

/* ---------------- ink ---------------- */

export const INK = {
  /** #FFFFFF · 18.5:1 on Charcoal. Headings and hero numerals only. */
  primary: '#FFFFFF',
  /** #E6E6E6 · 14.8:1. Body copy and workout instructions. */
  body: '#E6E6E6',
  /** #A3A3A3 · 7.3:1. Labels, captions, axis text, metadata. */
  secondary: '#A3A3A3',
  /** #7E858D · 5.0:1. The dimmest step that still clears AA for text. */
  tertiary: '#7E858D',
  /** #646B73 · 3.4:1 — BELOW AA. Hairlines and disabled marks. Never text. */
  faint: '#646B73',
} as const;

/* ---------------- status ---------------- */

/** Semantic, and deliberately separate from the accent. All clear AA on every surface. */
export const STATUS = {
  completed: '#2DFF8A',
  scheduled: '#8FB8D9',
  inProgress: '#FFB648',
  missed: '#FF6B5A',
  lowAdherence: '#FF9448',
} as const;

export type StatusKey = keyof typeof STATUS;

/* ---------------- lines ---------------- */

export const LINE = {
  hairline: 'rgba(230, 230, 230, 0.09)',
  hairlineStrong: 'rgba(230, 230, 230, 0.17)',
  /** Solid equivalents, for SVG where rgba on a known ground is wasteful. */
  solid: '#1E2328',
  solidStrong: '#2A2F35',
} as const;

/* ---------------- motion ---------------- */

/**
 * DRAW → BUILD → FORGE → COMPLETE.
 *
 * Four named stages, one vocabulary. A route line draws, training bars build,
 * an element forges into place, a completed session resolves. Anything that
 * does not map to one of these four does not belong in the product.
 */
export const MOTION = {
  /** A line being drawn along its own length. */
  draw: 1400,
  /** Bars and volumes accumulating from a baseline. */
  build: 700,
  /** An element locking into position. */
  forge: 420,
  /** A state resolving — completion, confirmation. */
  complete: 260,
  /** Per-item offset in a staggered group. */
  stagger: 60,
} as const;

export const EASE = {
  /** Decisive arrival. Fast out, settled — the default. */
  forge: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Even, mechanical. For continuous or reversible motion. */
  steel: 'cubic-bezier(0.65, 0, 0.35, 1)',
} as const;

/* ---------------- topography ---------------- */

/**
 * Opacity ceilings per context.
 *
 * Terrain is atmosphere, never content. These caps are the mechanism that keeps
 * it that way: `card` is deliberately near-invisible, and no context permits
 * contours beneath numerals or workout instructions.
 */
export const TOPO = {
  marketing: 0.1,
  header: 0.055,
  card: 0.035,
  empty: 0.07,
  /** Contour geometry. */
  spacing: 26,
  strokeWidth: 1,
} as const;

export type TopoContext = 'marketing' | 'header' | 'card' | 'empty';

/* ---------------- ForgeLine ---------------- */

export const FORGE_LINE = {
  stroke: 1.6,
  strokeBold: 2,
  /** Endpoint node radius, plus the surface-coloured ring that keeps it legible. */
  node: 3,
  nodeRing: 2,
  /** Area fill under an elevation or performance line. */
  fillTop: 0.22,
  fillBottom: 0,
  /** Reference (prescribed / target) marks sit in steel, never in a second hue. */
  reference: SURFACE.steel,
} as const;

/* ---------------- type ---------------- */

export const TYPE = {
  family:
    '"Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
  /** Display is always uppercase with tight tracking; micro is wide and small. */
  tracking: { display: '0.005em', body: '0', micro: '0.18em', microWide: '0.24em' },
} as const;

/* ---------------- chart surface ---------------- */

/**
 * What the charts draw on and with. Kept here so the chart layer and the
 * ForgeLine layer cannot drift apart — they are the same visual language.
 */
export const CHART_SURFACE = {
  background: SURFACE.charcoal,
  grid: 'rgba(230, 230, 230, 0.07)',
  axis: INK.secondary,
  label: INK.secondary,
  measured: ACCENT.mint,
  reference: SURFACE.steel,
  ink: INK.body,
} as const;
