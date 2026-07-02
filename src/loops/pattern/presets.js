// Pattern loops — ONE rule/tiling engine (patternLoop), many PRESETS. Each preset
// is a full config of the engine (render kind · shape/grid or band geometry ·
// rules · colours · camera · animation) that the picker lists; sub = the labs
// /pattern category (Stripes / Tartan / Blocks / Organic / Interlace / Weave).
// Ported from kol-labs-single src/pages/pattern/categories/*.js — the params
// objects are source-verbatim, reshaped into the loops preset idiom (the labs
// registry stamped route/path metadata instead; the editor picks via dropdowns).
// Add a base loop to PATTERN_LOOPS, picker entries to PATTERN_PRESETS.

import patternLoop from './patternLoop.js'

export const PATTERN_LOOPS = [patternLoop]

// A rule = a selector + per-cell transform (labs categories/_helpers.js R()).
// Defaults match the engine's newRule shape; override only what a preset needs.
let rid = 0
const R = (o = {}) => ({
  id: `pr${++rid}`,
  selectKind: 'all', n: 2, offset: 0, n2: 2, offset2: 0,
  expression: 'sin(col * 0.6) + cos(row * 0.6)',
  groupW: 1, groupH: 1, rotate: 0, flipH: false, flipV: false, hide: false, opacity: 1,
  ...o,
})

// Coherent colour vocabulary — warm earths, brights and inks (labs PAL).
const PAL = {
  ink: '#0e0e11', char: '#1a1a1f', noir: '#06060a',
  paper: '#f3ede1', cream: '#e8e4dc', bone: '#fcfbf8', oat: '#d8cfbe',
  red: '#c2502e', rust: '#a83e22', brick: '#8c3a26', coral: '#e0664a',
  amber: '#f6c453', gold: '#e0a32e', ochre: '#c98a2b',
  teal: '#2a8f8f', sky: '#7fd1ff', blue: '#3a6ea5', navy: '#1b2a6b', ink2: '#13204a',
  purple: '#8f5ad0', plum: '#5b2a6b', violet: '#6d4aa8',
  green: '#3f7d4f', forest: '#27543a', olive: '#7d7d3f', moss: '#5c6b3a',
  pink: '#e08aa8', rose: '#c25b7a', grey: '#6b6b6b', slate: '#4a4f5a',
  // tartan grounds
  beige: '#d6c4a0', tan: '#c9b487', camel: '#b89b6a',
}

const P = (id, label, params, sub) => ({ id, label, loop: 'pattern-rules', params, sub })

// Render-kind stampers (the labs category files' local helpers) — every preset in
// a field/weave family carries its render kind; tile presets omit it ('tiles').
const stripe = (o) => ({ render: 'field', field: 'stripes', waveAmp: 0, ...o })
const tartan = (o) => ({ render: 'field', field: 'tartan', ...o })
const wave = (o) => ({ render: 'field', field: 'organic', ...o })
const weave = (o) => ({ render: 'weave', ...o })

export const PATTERN_PRESETS = [
  // ── Stripes — continuous directional band field (fields/stripeField.js) ──
  P('awning', 'Awning', stripe({
    stripeAngle: 0, stripePitch: 96, bandCount: 2, duty: 1,
    color: PAL.red, color2: PAL.cream, bg: PAL.ink }), 'Stripes'),
  P('deckchair', 'Deckchair', stripe({
    stripeAngle: 0, stripePitch: 64, bandCount: 3, duty: 1,
    color: PAL.teal, color2: PAL.amber, color3: PAL.coral, bg: PAL.ink }), 'Stripes'),
  P('corduroy', 'Corduroy', stripe({
    stripeAngle: 0, stripePitch: 16, bandCount: 3, duty: 1,
    color: PAL.rust, color2: PAL.brick, color3: PAL.coral, bg: PAL.noir }), 'Stripes'),
  P('candy-cane', 'Candy', stripe({
    stripeAngle: 45, stripePitch: 48, bandCount: 3, duty: 1,
    color: PAL.red, color2: PAL.bone, color3: PAL.rose, bg: PAL.ink }), 'Stripes'),
  P('gradient-bands', 'Gradient bands', stripe({
    stripeAngle: 0, stripePitch: 64, bandCount: 2, duty: 1, edgeSoftness: 1,
    color: PAL.violet, color2: PAL.sky, bg: PAL.noir }), 'Stripes'),
  P('barber', 'Barber', stripe({
    stripeAngle: 72, stripePitch: 40, bandCount: 3, duty: 1,
    color: PAL.red, color2: PAL.bone, color3: PAL.blue, bg: PAL.ink }), 'Stripes'),
  P('chevron', 'Chevron', stripe({
    stripeAngle: 60, stripePitch: 40, bandCount: 3, duty: 1,
    color: PAL.teal, color2: PAL.cream, color3: PAL.navy, bg: PAL.ink }), 'Stripes'),
  P('pinstripe', 'Pinstripe', stripe({
    stripeAngle: 0, stripePitch: 40, bandCount: 1, duty: 0.12,
    color: PAL.cream, bg: PAL.navy }), 'Stripes'),
  P('venetian', 'Venetian', stripe({
    stripeAngle: 90, stripePitch: 46, bandCount: 1, duty: 0.62,
    color: PAL.oat, bg: PAL.slate }), 'Stripes'),

  // ── Tartan — woven plaid: sett threadcounts as a field (fields/tartanField.js);
  // argyle + houndstooth are genuine TILE tessellations, kept on the tile engine ──
  P('burberry', 'Burberry', tartan({
    sett: 'royal', settScale: 5, twill: 0.16,
    color: PAL.camel, color2: PAL.red, color3: PAL.ink, bg: PAL.bone }), 'Tartan'),
  P('gingham', 'Gingham', tartan({
    sett: 'gingham', settScale: 6, twill: 0,
    color: PAL.red, bg: PAL.cream }), 'Tartan'),
  P('buffalo-check', 'Buffalo check', tartan({
    sett: 'buffalo', settScale: 9, twill: 0.1,
    color: PAL.red, color2: PAL.ink }), 'Tartan'),
  P('madras', 'Madras', tartan({
    sett: 'madras', settScale: 5, twill: 0.2,
    color: PAL.green, color2: PAL.gold, color3: PAL.red }), 'Tartan'),
  P('windowpane', 'Windowpane', tartan({
    sett: 'windowpane', settScale: 6, twill: 0,
    color: PAL.navy, color2: PAL.sky }), 'Tartan'),
  P('black-watch', 'Black Watch', tartan({
    sett: 'black-watch', settScale: 5, twill: 0.2,
    color: PAL.navy, color2: PAL.forest, color3: PAL.ink }), 'Tartan'),
  P('royal-stewart', 'Royal Stewart', tartan({
    sett: 'royal', settScale: 5, twill: 0.2,
    color: PAL.red, color2: PAL.navy, color3: PAL.forest, bg: PAL.bone }), 'Tartan'),
  P('glen-plaid', 'Glen plaid', tartan({
    sett: 'glen', settScale: 4, twill: 0.22,
    color: PAL.slate, bg: PAL.cream }), 'Tartan'),
  P('argyle', 'Argyle', {
    shape: 'prim:diamond', cols: 4, rows: 4, cell: 130, gap: -10, stretch: true, showGrid: true,
    colorRule: 'diag', color: PAL.forest, color2: PAL.oat, color3: PAL.brick, bg: PAL.cream,
    animAxis: 'diag', animWaves: 2, colorMix: 0.14 }, 'Tartan'),
  P('houndstooth', 'Houndstooth', {
    shape: 'prim:triangle', cols: 8, rows: 8, cell: 88, gap: -4, stretch: true,
    colorRule: 'checker', color: PAL.ink, color2: PAL.bone, bg: PAL.ink,
    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ selectKind: 'every-row', n: 2, flipV: true })],
    animAxis: 'diag', animWaves: 3, fade: 0.12 }, 'Tartan'),

  // ── Blocks — rectangular tilings, big-and-few ↔ small-and-many ──
  P('mega-quad', 'Mega quad', {
    shape: 'prim:square', cols: 2, rows: 2, cell: 240, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.red, color2: PAL.amber, color3: PAL.navy, bg: PAL.ink,
    animAxis: 'diag', animWaves: 1, fade: 0.2 }, 'Blocks'),
  P('bauhaus', 'Bauhaus', {
    shape: 'prim:square', cols: 3, rows: 3, cell: 200, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.red, color2: PAL.gold, color3: PAL.blue, bg: PAL.ink,
    rules: [R({ selectKind: 'every-nth', n: 5, offset: 2, hide: true })],
    animAxis: 'diag', animWaves: 1.5, colorMix: 0.15 }, 'Blocks'),
  P('mondrian', 'Mondrian', {
    shape: 'prim:square', cols: 6, rows: 6, cell: 95, gap: 6, stretch: true,
    colorRule: 'cols', color: PAL.bone, color2: PAL.red, color3: PAL.blue, bg: PAL.ink,
    rules: [
      R({ selectKind: 'both', n: 3, n2: 3, groupW: 2, groupH: 2 }),
      R({ selectKind: 'both', n: 6, n2: 6, offset: 4, offset2: 2, groupW: 3, groupH: 2, opacity: 0.85 }),
      R({ selectKind: 'expression', expression: 'col===4 && row===1', hide: true }),
    ],
    animAxis: 'col', animWaves: 1, fade: 0.15 }, 'Blocks'),
  P('pixel-check', 'Pixel check', {
    shape: 'prim:square', cols: 24, rows: 24, cell: 50, gap: 0, stretch: true,
    colorRule: 'checker', color: PAL.ink, color2: PAL.bone, bg: PAL.ink,
    animAxis: 'diag', animWaves: 6, fade: 0.2 }, 'Blocks'),
  P('terrazzo', 'Terrazzo', {
    shape: 'prim:diamond', cols: 26, rows: 26, cell: 46, gap: 6, stretch: true,
    colorRule: 'rows', color: PAL.oat, color2: PAL.teal, color3: PAL.rust, bg: PAL.char,
    rules: [R({ selectKind: 'expression', expression: 'sin(col*1.3 + row*0.7)', opacity: 0.5 })],
    animAxis: 'radial', animWaves: 4, fade: 0.3 }, 'Blocks'),
  P('mortar', 'Mortar', {
    shape: 'prim:square', cols: 8, rows: 8, cell: 110, gap: 12, stretch: true,
    colorRule: 'none', color: PAL.rust, bg: PAL.cream,
    animAxis: 'diag', animWaves: 2, fade: 0.2 }, 'Blocks'),
  P('brick-courses', 'Brick courses', {
    shape: 'prim:square', cols: 10, rows: 12, cell: 100, gap: 5, stretch: true,
    colorRule: 'rows', color: PAL.brick, color2: PAL.rust, color3: PAL.coral, bg: PAL.char,
    rules: [R({ selectKind: 'every-row', n: 2, offset: 1, opacity: 0.82 })],
    animAxis: 'row', animWaves: 3, fade: 0.2 }, 'Blocks'),
  P('diamond-grid', 'Diamond grid', {
    shape: 'prim:diamond', cols: 6, rows: 6, cell: 120, gap: 0, stretch: true,
    colorRule: 'diag', color: PAL.purple, color2: PAL.amber, color3: PAL.teal, bg: PAL.noir,
    animAxis: 'diag', animWaves: 2, colorMix: 0.15 }, 'Blocks'),
  P('super-cells', 'Super cells', {
    shape: 'prim:square', cols: 8, rows: 8, cell: 90, gap: 5, stretch: true,
    colorRule: 'checker', color: PAL.ochre, color2: PAL.slate, bg: PAL.ink,
    rules: [
      R({ selectKind: 'checker', groupW: 2, groupH: 2, opacity: 0.8 }),
      R({ selectKind: 'every-nth', n: 7, offset: 3, groupW: 2, groupH: 2, hide: true }),
    ],
    animAxis: 'col', animWaves: 2, fade: 0.2 }, 'Blocks'),
  P('cascade', 'Cascade', {
    shape: 'prim:square', cols: 10, rows: 6, cell: 100, gap: 4, stretch: true,
    colorRule: 'none', color: PAL.sky, bg: PAL.noir,
    rules: [
      R({ selectKind: 'every-col', n: 10, offset: 8, opacity: 0.35 }),
      R({ selectKind: 'every-col', n: 10, offset: 6, opacity: 0.55 }),
      R({ selectKind: 'every-col', n: 10, offset: 4, opacity: 0.75 }),
    ],
    animAxis: 'col', animWaves: 2, fade: 0.2 }, 'Blocks'),

  // ── Organic — bands with a wavy edge profile (fields/organicField.js), plus a
  // few genuine dot/abstract tile marks for variety ──
  P('waves', 'Waves', wave({
    stripeAngle: 90, stripePitch: 90, bandCount: 2, waveAmp: 0.4, waveFreq: 1.4,
    color: PAL.sky, color2: PAL.ink2 }), 'Organic'),
  P('tidal', 'Tide', wave({
    stripeAngle: 90, stripePitch: 110, bandCount: 3, waveAmp: 0.5, waveFreq: 1,
    color: PAL.teal, color2: PAL.navy, color3: PAL.sky }), 'Organic'),
  P('dunes', 'Dunes', wave({
    stripeAngle: 90, stripePitch: 120, bandCount: 3, waveAmp: 0.6, waveFreq: 0.8,
    color: PAL.gold, color2: PAL.ochre, color3: PAL.amber }), 'Organic'),
  P('ripple', 'Ripple', wave({
    stripeAngle: 90, stripePitch: 60, bandCount: 2, waveAmp: 0.35, waveFreq: 2.4,
    color: PAL.bone, color2: PAL.teal }), 'Organic'),
  P('contour-bands', 'Contour', wave({
    stripeAngle: 90, stripePitch: 70, bandCount: 3, waveAmp: 0.45, waveFreq: 1.6,
    color: PAL.moss, color2: PAL.forest, color3: PAL.olive }), 'Organic'),
  P('strata', 'Strata', wave({
    stripeAngle: 90, stripePitch: 100, bandCount: 3, waveAmp: 0.3, waveFreq: 1.1,
    color: PAL.rust, color2: PAL.brick, color3: PAL.coral }), 'Organic'),
  P('current', 'Current', wave({
    stripeAngle: 90, stripePitch: 80, bandCount: 2, waveAmp: 0.55, waveFreq: 1.8,
    color: PAL.blue, color2: PAL.navy }), 'Organic'),
  P('swell', 'Swell', wave({
    stripeAngle: 90, stripePitch: 140, bandCount: 2, waveAmp: 0.7, waveFreq: 0.7,
    color: PAL.sky, color2: PAL.ink2 }), 'Organic'),
  P('marble', 'Marble', wave({
    stripeAngle: 70, stripePitch: 64, bandCount: 3, waveAmp: 0.5, waveFreq: 2,
    color: PAL.bone, color2: PAL.slate, color3: PAL.oat }), 'Organic'),
  P('lava-flow', 'Lava flow', wave({
    stripeAngle: 90, stripePitch: 96, bandCount: 3, waveAmp: 0.65, waveFreq: 1.2,
    color: PAL.amber, color2: PAL.red, color3: PAL.brick }), 'Organic'),
  P('aurora-bands', 'Aurora', wave({
    stripeAngle: 80, stripePitch: 110, bandCount: 3, waveAmp: 0.6, waveFreq: 1.3,
    color: PAL.teal, color2: PAL.purple, color3: PAL.sky }), 'Organic'),
  P('sand', 'Sand', wave({
    stripeAngle: 90, stripePitch: 48, bandCount: 2, waveAmp: 0.3, waveFreq: 2.6,
    color: PAL.oat, color2: PAL.camel }), 'Organic'),
  P('polka', 'Polka', {
    shape: 'prim:circle', cols: 6, rows: 6, cell: 120, gap: 14,
    colorRule: 'checker', color: PAL.cream, color2: PAL.red, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, fade: 0.25 }, 'Organic'),
  P('pin-dots', 'Pin dots', {
    shape: 'prim:circle', cols: 14, rows: 14, cell: 70, gap: 18,
    color: PAL.bone, bg: PAL.navy,
    animAxis: 'radial', animWaves: 3, fade: 0.3 }, 'Organic'),
  P('halftone-dots', 'Halftone', {
    shape: 'prim:circle', cols: 22, rows: 22, cell: 52, gap: 6,
    color: PAL.ink, bg: PAL.bone,
    animAxis: 'radial', animWaves: 3, pulse: 0.4 }, 'Organic'),
  P('honeycomb', 'Honeycomb', {
    shape: 'prim:hexagon', cols: 8, rows: 8, cell: 120, gap: 6,
    color: PAL.gold, bg: PAL.ochre,
    animAxis: 'radial', animWaves: 2, fade: 0.2 }, 'Organic'),
  P('scatter', 'Scatter', {
    shape: 'prim:circle', cols: 16, rows: 16, cell: 80, gap: 8,
    color: PAL.gold, bg: PAL.ink,
    rules: [R({ selectKind: 'expression', expression: 'sin(col*12.9 + row*7.3) - 0.2', hide: true })],
    animAxis: 'radial', animWaves: 3, fade: 0.35 }, 'Organic'),
  P('petals', 'Petals', {
    shape: 'abstract:abstract-01', cols: 6, rows: 6, cell: 150, gap: 8,
    colorRule: 'checker', color: PAL.pink, color2: PAL.rose, bg: PAL.plum,
    spin: 1, animAxis: 'diag', animWaves: 2, swing: 35, fade: 0.25 }, 'Organic'),

  // ── Interlace — woven-LOOKING tile tessellations (the true over/under weaves
  // are the Weave sub below) ──
  P('herringbone', 'Herringbone', {
    shape: 'prim:triangle', cols: 10, rows: 10, cell: 76, gap: -2,
    colorRule: 'checker', color: PAL.camel, color2: PAL.tan, bg: PAL.char,
    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ selectKind: 'every-row', n: 2, flipV: true })],
    animAxis: 'diag', animWaves: 3, fade: 0.18 }, 'Interlace'),
  P('chevron-weave', 'Chevron weave', {
    shape: 'prim:triangle', cols: 8, rows: 8, cell: 90, gap: 0,
    colorRule: 'rows', color: PAL.teal, color2: PAL.sky, color3: PAL.navy, bg: PAL.ink2,
    rules: [R({ selectKind: 'every-col', n: 2, flipH: true }), R({ selectKind: 'every-row', n: 2, flipV: true })],
    animAxis: 'diag', animWaves: 3, colorMix: 0.15, fade: 0.2 }, 'Interlace'),
  P('lattice', 'Lattice', {
    shape: 'prim:plus', cols: 8, rows: 8, cell: 90, gap: 6, showGrid: true,
    colorRule: 'checker', color: PAL.cream, color2: PAL.oat, bg: PAL.brick,
    animAxis: 'diag', animWaves: 2, fade: 0.2 }, 'Interlace'),
  P('chainlink', 'Chainlink', {
    shape: 'prim:diamond', cols: 8, rows: 8, cell: 96, gap: -12,
    colorRule: 'checker', color: PAL.slate, color2: PAL.bone, bg: PAL.ink,
    animAxis: 'diag', animWaves: 2, fade: 0.2 }, 'Interlace'),
  P('netting', 'Netting', {
    shape: 'prim:diamond', cols: 10, rows: 10, cell: 78, gap: -4,
    color: PAL.sky, bg: PAL.ink2,
    rules: [R({ selectKind: 'every-nth', n: 3, offset: 1, opacity: 0.55 })],
    animAxis: 'radial', animWaves: 3, fade: 0.25 }, 'Interlace'),

  // ── Weave — true over/under interlacing (render:'weave'); color = warp,
  // color2 = weft, bg = the gaps ──
  P('plain-weave', 'Plain weave', weave({
    weaveType: 'plain', cols: 8, rows: 8, cell: 90, gap: 4, strandWidth: 0.74,
    color: PAL.camel, color2: PAL.tan, bg: PAL.char }), 'Weave'),
  P('twill-weave', 'Twill weave', weave({
    weaveType: 'twill', cols: 10, rows: 10, cell: 78, gap: 4, strandWidth: 0.76,
    color: PAL.navy, color2: PAL.blue, bg: PAL.ink }), 'Weave'),
  P('basketweave', 'Basketweave', weave({
    weaveType: 'basket', cols: 8, rows: 8, cell: 88, gap: 4, strandWidth: 0.8,
    color: PAL.amber, color2: PAL.ochre, bg: PAL.noir }), 'Weave'),
  P('satin-weave', 'Satin weave', weave({
    weaveType: 'satin', cols: 10, rows: 10, cell: 76, gap: 3, strandWidth: 0.78,
    color: PAL.gold, color2: PAL.amber, bg: PAL.ink }), 'Weave'),
  P('mesh', 'Mesh', weave({
    weaveType: 'plain', cols: 16, rows: 16, cell: 60, gap: 5, strandWidth: 0.5,
    color: PAL.ink, color2: PAL.slate, bg: PAL.bone }), 'Weave'),
]
