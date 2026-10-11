/**
 * Chart tokens — one system across the whole product.
 *
 * The brand is locked to a single accent, so charts use an EMPHASIS palette,
 * not a categorical one: the measured series wears Miles Green, and any
 * reference series (a target, a prescription) is deliberately recessive gray.
 * That is why a categorical-palette validator flags this pair — the gray is
 * meant to read as gray. Colour is never the only channel: reference series
 * also differ in mark type (line vs column), and every multi-series chart
 * carries a legend.
 *
 * Where four measures must be compared (wellbeing), we facet into small
 * multiples rather than invent three more hues.
 */
import { ACCENT, INK, LINE, STATUS, SURFACE } from '@/lib/tokens';

export const CHART = {
  surface: SURFACE.charcoal,
  accent: ACCENT.mint,
  accentDim: ACCENT.mintDim,
  /** Prescribed / target marks sit in steel — recessive by design, not a second hue. */
  reference: SURFACE.steel,
  grid: LINE.hairline,
  axisText: INK.secondary,
  labelText: INK.secondary,
  ink: INK.body,
  warn: STATUS.inProgress,
  alert: STATUS.missed,
} as const;

/** Fixed mark specs — thin marks, hairline chrome, air around everything. */
export const MARKS = {
  barMaxWidth: 22,
  barRadius: [3, 3, 0, 0] as [number, number, number, number],
  lineWidth: 2,
  dotRadius: 4,
  ringWidth: 2,
  areaOpacity: 0.1,
} as const;

export const AXIS_PROPS = {
  stroke: CHART.grid,
  tick: { fill: CHART.axisText, fontSize: 10, letterSpacing: '0.08em' },
  tickLine: false,
  axisLine: { stroke: CHART.grid },
} as const;

export const GRID_PROPS = {
  stroke: CHART.grid,
  strokeDasharray: '0',
  vertical: false,
} as const;
