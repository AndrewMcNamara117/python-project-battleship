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
export const CHART = {
  surface: '#0a0b0b',
  accent: '#2dff8a',
  accentDim: '#1f9e5a',
  reference: '#5d625f',
  grid: 'rgba(238,238,238,0.075)',
  axisText: '#5d625f',
  labelText: '#8b918d',
  ink: '#eeeeee',
  warn: '#ffb648',
  alert: '#ff6b5a',
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
