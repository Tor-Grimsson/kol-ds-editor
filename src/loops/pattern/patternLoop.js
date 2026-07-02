import { TAU, mixHex, hexToRgb } from '../lib/util.js'
import { resolveShape, DEFAULT_SHAPE_ID, SHAPE_OPTIONS } from './shapes.js'
import { composeCell, compileRules } from './rules.js'
import { drawStripes } from './fields/stripeField.js'
import { drawTartan } from './fields/tartanField.js'
import { drawOrganic } from './fields/organicField.js'
import { SETT_OPTIONS } from './fields/setts.js'

// Pattern — the ported kol-client rule/tiling system, rendered to Canvas2D so it
// animates + outputs a texture. The cols×rows rule-block TILES infinitely; the
// camera (zoom/angle + flow drift) moves THROUGH it, and `spin` morphs the cells.
//
// On top of the static rules, an ANIMATION sweep brings the tiles to life: a
// time-driven wave (axis diag/col/row/radial, like the rule selectors) phased by
// each cell's world position drives per-cell size (pulse), opacity (fade),
// rotation sway (swing) and colour (mix → color2). Seamless: the only u-terms are
// `u·TAU·animCycles`, `u·TAU·camFlow` and `u·360·spin`, all whole cycles.
//
// Ported from kol-labs-single MINUS the 'glyph' tile shape — that branch pulled
// letterform outlines via opentype.js (labs lib/glyphPath.js), a dependency this
// editor deliberately excludes. Everything else (tiles / field / weave renders)
// is source-verbatim.
//
// Editor surface: labs drove this loop with a bespoke PatternControls panel; here
// the `params` schema below IS the inspector (AutoControls), gated by `when` on
// the layer's render kind. The complex state (rules arrays, render/field kind,
// wave curves) lives in `defaults` + the presets and rides along on the layer.

let cache = null // { key, viewBox, paths:[Path2D] }
let rulesCache = null // { key, compiled }
function buildPaths(viewBox, paths) {
  const built = []
  for (const d of paths) { try { built.push(new Path2D(d)) } catch { /* skip bad path */ } }
  return { viewBox, paths: built }
}
function shapeFor(id, customSvg) {
  const key = id + '|' + (id === 'custom' ? customSvg : '')
  if (cache && cache.key === key) return cache
  const { viewBox, paths } = resolveShape(id, customSvg)
  cache = { key, ...buildPaths(viewBox, paths) }
  return cache
}

const MAX_CELLS = 6000 // safety cap for extreme zoom-out

// Pan direction → (x, y) block multipliers (×camFlow). Integer only ⇒ seamless.
const PAN_VEC = {
  right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1],
  diag: [1, 1], anti: [1, -1],
}

// Field families (render:'field') — continuous VECTOR renderers that bypass the
// tile loop. All three are cheap geometry (rects / filled paths), NOT per-pixel:
// stripes = bands · tartan = crossed sett bands · organic = bands with a wavy edge.
// Each reads the pattern palette (color/color2/color3 + bg). Seamless on whole-
// cycle phase (u·TAU·round(camFlow)).
const FIELD_DRAW = { stripes: drawStripes, tartan: drawTartan, organic: drawOrganic }
function drawField(ctx, u, w, h, p) {
  (FIELD_DRAW[p.field] || drawStripes)(ctx, u, w, h, p)
}

// Weave (render:'weave') — true over/under interlacing. Per crossing the warp
// (vertical) and weft (horizontal) ribbons overlap; a parity fn decides which is
// drawn SECOND (on top), so strands genuinely pass over and under across the field.
const parityWeave = (type, col, row) => {
  switch (type) {
    case 'twill':  return ((((col - row) % 4) + 4) % 4) < 2     // diagonal wales
    case 'satin':  return (((col * 2 + row * 3) % 5) + 5) % 5 === 0 // sparse floats
    case 'basket': return ((Math.floor(col / 2) + Math.floor(row / 2)) & 1) === 0
    default:       return ((col + row) & 1) === 0                // plain
  }
}
function drawWeave(ctx, u, w, h, p) {
  const cols = Math.max(1, p.cols | 0)
  const rows = Math.max(1, p.rows | 0)
  const cell = Math.max(8, p.cell)
  const period = cell + (p.gap || 0)
  if (period <= 0) return
  const z = p.camZoom || 1
  const ang = (p.camAngle || 0) * Math.PI / 180
  const flow = Math.round(p.camFlow || 0)
  const baseHalf = Math.max(1, (p.strandWidth ?? 0.7) * cell) / 2
  const weave = p.weaveType || 'plain'
  const warpCol = p.color, weftCol = p.color2 || p.color
  const warpLit = mixHex(warpCol, '#ffffff', 0.2), weftLit = mixHex(weftCol, '#ffffff', 0.2)
  // Collinear ribbon segments from adjacent cells must OVERLAP, not abut — exact
  // abutment leaves a sub-pixel AA seam (the faint grid the strands read through).
  // Extend each segment ~1 device px past the cell midpoint so neighbours overlap.
  const len = period + 2 / z

  // FORM — per-crossing pulse/fade swept diagonally (the same sweep the tile engine
  // uses), so the weave gets a Motion Form too. Seamless: u only via tphase.
  const axis = p.animAxis || 'none'
  const formOn = axis !== 'none' && (p.pulse || p.fade)
  const cyc = Math.round(p.animCycles || 0)
  const wav = p.animWaves || 0
  const tphase = u * TAU * cyc

  // Frame — the whole woven sheet PANS (translates) in the picked direction. Seamless:
  // the parity wraps on cols/rows, so panning whole cols/rows repeats per loop lands
  // identically. (flow=0 ⇒ static.)
  const [fx, fy] = PAN_VEC[p.panDir] || PAN_VEC.right
  const panX = u * flow * fx * cols * period
  const panY = u * flow * fy * rows * period

  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate(ang)
  ctx.scale(z, z)
  ctx.translate(-panX, -panY)

  const reach = (Math.hypot(w, h) / 2) / z + period * 2
  const gx0 = Math.floor((panX - reach) / period), gx1 = Math.ceil((panX + reach) / period)
  const gy0 = Math.floor((panY - reach) / period), gy1 = Math.ceil((panY + reach) / period)

  // ribbon = base fill + a centre sheen (tube/cord read).
  const ribbon = (cx, cy, vert, base, lit, half) => {
    ctx.fillStyle = base
    if (vert) ctx.fillRect(cx - half, cy - len / 2, half * 2, len)
    else ctx.fillRect(cx - len / 2, cy - half, len, half * 2)
    ctx.fillStyle = lit
    const sh = half * 0.6
    if (vert) ctx.fillRect(cx - sh, cy - len / 2, sh * 2, len)
    else ctx.fillRect(cx - len / 2, cy - sh, len, sh * 2)
  }

  let count = 0
  for (let gy = gy0; gy <= gy1; gy++) {
    for (let gx = gx0; gx <= gx1; gx++) {
      if (++count > MAX_CELLS) { ctx.restore(); return }
      const col = ((gx % cols) + cols) % cols
      const row = ((gy % rows) + rows) % rows
      const cx = gx * period, cy = gy * period

      // Per-crossing Form sweep (k 0..1, plain sine ⇒ seamless): Pulse breathes the
      // strand width, Fade its opacity, phased by axis across the field.
      let half = baseHalf
      if (formOn) {
        const sp = axis === 'col' ? gx : axis === 'row' ? gy : axis === 'radial' ? Math.hypot(gx, gy) : gx + gy
        const k = 0.5 + 0.5 * Math.sin(tphase - sp * 0.5 * wav)
        if (p.pulse) half = baseHalf * (1 - p.pulse + p.pulse * k)
        ctx.globalAlpha = p.fade ? (1 - p.fade + p.fade * k) : 1
      }

      const warpOver = parityWeave(weave, col, row)
      if (warpOver) { ribbon(cx, cy, false, weftCol, weftLit, half); ribbon(cx, cy, true, warpCol, warpLit, half) }
      else { ribbon(cx, cy, true, warpCol, warpLit, half); ribbon(cx, cy, false, weftCol, weftLit, half) }
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

// ── Inspector schema options (select vocabularies) ────────────────────────────
const TILE_SHAPE_OPTIONS = SHAPE_OPTIONS.filter((o) => o.value !== 'custom')
const DIR_OPTIONS = [
  { value: 'right', label: 'Right' }, { value: 'left', label: 'Left' },
  { value: 'up', label: 'Up' }, { value: 'down', label: 'Down' },
  { value: 'diag', label: 'Diagonal' }, { value: 'anti', label: 'Anti-diagonal' },
]
const FIELD_DIR_OPTIONS = [
  { value: 'right', label: 'Right' }, { value: 'left', label: 'Left' },
  { value: 'split', label: 'Split' },
]
const AXIS_OPTIONS = [
  { value: 'none', label: 'None' }, { value: 'diag', label: 'Diagonal' },
  { value: 'col', label: 'Columns' }, { value: 'row', label: 'Rows' },
  { value: 'radial', label: 'Radial' },
]
const COLOR_RULE_OPTIONS = [
  { value: 'none', label: 'None' }, { value: 'checker', label: 'Checker' },
  { value: 'cols', label: 'Columns' }, { value: 'rows', label: 'Rows' },
  { value: 'diag', label: 'Diagonal' },
]
const WEAVE_OPTIONS = [
  { value: 'plain', label: 'Plain' }, { value: 'twill', label: 'Twill' },
  { value: 'satin', label: 'Satin' }, { value: 'basket', label: 'Basket' },
]
// Named organic edge profiles (fields/organicField.js PROFILES). 'custom'
// (editable bezier via waveCurve) is preset-only — no curve editor here.
const PROFILE_OPTIONS = [
  { value: 'sine', label: 'Sine' }, { value: 'blob', label: 'Blob' },
  { value: 'hump', label: 'Hump' }, { value: 'swell', label: 'Swell' },
  { value: 'double', label: 'Double' }, { value: 'ripple', label: 'Ripple' },
  { value: 'tri', label: 'Triangle' }, { value: 'ridge', label: 'Ridge' },
  { value: 'pinch', label: 'Pinch' }, { value: 'saw', label: 'Saw' },
  { value: 'step', label: 'Step' },
]

// Render-kind guards for `when` — the layer carries the preset's full param set,
// so `render` / `field` ride along and gate which knobs the inspector shows.
const isTiles = (l) => (l.render || 'tiles') === 'tiles'
const isField = (l) => l.render === 'field'
const isBands = (l) => isField(l) && (l.field || 'stripes') !== 'tartan' // stripes + organic
const isStripes = (l) => isField(l) && (l.field || 'stripes') === 'stripes'
const isOrganic = (l) => isField(l) && l.field === 'organic'
const isTartan = (l) => isField(l) && l.field === 'tartan'
const isWeave = (l) => l.render === 'weave'

export default {
  id: 'pattern-rules',
  label: 'Pattern',
  group: 'pattern',
  kind: '2d',
  duration: 8,
  // The simple knobs, auto-rendered by the inspector (AutoControls) and gated by
  // `when` on the render kind. Colour ROLES drive theme recolour; noRandom keeps
  // Randomise off the structural grid so it never thrashes the tiling geometry.
  // The full param object comes from `defaults` (loopDefaults escape hatch) —
  // opaque params (rules arrays, render/field kind, waveCurve) have no schema
  // entry and ride along on the layer untouched.
  params: [
    // Palette
    { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: '#0e0e11' },
    { key: 'color', label: 'Colour', type: 'color', role: 'fg', default: '#fcfbf8' },
    { key: 'color2', label: 'Colour 2', type: 'color', role: 'accent', default: '#c2502e' },
    { key: 'color3', label: 'Colour 3', type: 'color', default: '#3f6485' },
    // Tiles — shape + grid (grid shared with weave)
    { key: 'shape', label: 'Shape', type: 'select', options: TILE_SHAPE_OPTIONS, default: DEFAULT_SHAPE_ID, when: isTiles },
    { key: 'cols', label: 'Cols', type: 'range', min: 1, max: 32, step: 1, default: 4, noRandom: true, animatable: false, when: (l) => !isField(l) },
    { key: 'rows', label: 'Rows', type: 'range', min: 1, max: 32, step: 1, default: 4, noRandom: true, animatable: false, when: (l) => !isField(l) },
    { key: 'cell', label: 'Cell', type: 'range', min: 40, max: 280, step: 1, default: 120, noRandom: true, when: (l) => !isField(l) },
    { key: 'gap', label: 'Gap', type: 'range', min: -40, max: 80, step: 1, default: 8, when: (l) => !isField(l) },
    { key: 'stretch', label: 'Stretch', type: 'toggle', default: false, when: isTiles },
    { key: 'showGrid', label: 'Grid overlay', type: 'toggle', default: false, when: isTiles },
    { key: 'colorRule', label: 'Colour rule', type: 'select', options: COLOR_RULE_OPTIONS, default: 'none', when: isTiles },
    // Weave — the interlacing
    { key: 'weaveType', label: 'Weave', type: 'select', options: WEAVE_OPTIONS, default: 'plain', when: isWeave },
    { key: 'strandWidth', label: 'Strand width', type: 'range', min: 0.3, max: 1, step: 0.02, default: 0.7, when: isWeave },
    // Field — band geometry (stripes + organic)
    { key: 'stripeAngle', label: 'Band angle', type: 'range', min: 0, max: 180, step: 1, default: 0, when: isBands },
    { key: 'stripePitch', label: 'Pitch', type: 'range', min: 8, max: 200, step: 1, default: 60, when: isBands },
    { key: 'bandCount', label: 'Bands', type: 'range', min: 1, max: 3, step: 1, default: 2, when: isBands },
    { key: 'duty', label: 'Duty', type: 'range', min: 0.05, max: 1, step: 0.01, default: 1, when: isStripes },
    { key: 'edgeSoftness', label: 'Softness', type: 'range', min: 0, max: 1, step: 0.05, default: 0, when: isStripes },
    { key: 'waveAmp', label: 'Wave depth', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4, when: isBands },
    { key: 'waveFreq', label: 'Wave frequency', type: 'range', min: 0.2, max: 4, step: 0.1, default: 1.5, when: isBands },
    { key: 'waveProfile', label: 'Edge profile', type: 'select', options: PROFILE_OPTIONS, default: 'sine', when: isOrganic },
    // Field — tartan sett
    { key: 'sett', label: 'Sett', type: 'select', options: SETT_OPTIONS, default: 'black-watch', when: isTartan },
    { key: 'settScale', label: 'Thread scale', type: 'range', min: 1, max: 14, step: 0.5, default: 5, when: isTartan },
    { key: 'twill', label: 'Twill', type: 'range', min: 0, max: 0.5, step: 0.02, default: 0.18, when: isTartan },
    // Camera / Frame (all render kinds; flow is whole cycles ⇒ seamless)
    { key: 'camZoom', label: 'Zoom', type: 'range', min: 0.3, max: 3, step: 0.05, default: 1 },
    { key: 'camAngle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 0 },
    { key: 'camFlow', label: 'Flow', type: 'range', min: 0, max: 4, step: 1, default: 1 },
    { key: 'panDir', label: 'Direction', type: 'select', options: DIR_OPTIONS, default: 'diag', when: (l) => !isBands(l) },
    { key: 'panDir', label: 'Direction', type: 'select', options: FIELD_DIR_OPTIONS, default: 'right', noRandom: true, when: isBands },
    { key: 'spin', label: 'Spin', type: 'range', min: 0, max: 3, step: 1, default: 0, when: isTiles },
    // Field — along-axis travel + per-band Form (whole cycles ⇒ seamless)
    { key: 'waveFlow', label: 'Travel', type: 'range', min: 0, max: 4, step: 1, default: 0, when: isField },
    { key: 'fieldSway', label: 'Sway', type: 'range', min: 0, max: 1, step: 0.05, default: 0, when: isField },
    { key: 'fieldStagger', label: 'Stagger', type: 'range', min: 0, max: 1, step: 0.05, default: 0, when: isField },
    { key: 'fieldCycles', label: 'Form cycles', type: 'range', min: 1, max: 4, step: 1, default: 1, when: isField },
    // Split-gap fill (only meaningful when Direction = Split)
    { key: 'fillMode', label: 'Split fill', type: 'select', default: 'off', when: (l) => isBands(l) && l.panDir === 'split',
      options: [{ value: 'off', label: 'Off' }, { value: 'extend', label: 'Extend' }, { value: 'solid', label: 'Solid' }] },
    { key: 'fillColor', label: 'Fill colour', type: 'color', default: '#101014', when: (l) => isBands(l) && l.panDir === 'split' && l.fillMode === 'solid' },
    // Animation sweep (per-cell tiles / per-crossing weave)
    { key: 'animAxis', label: 'Sweep axis', type: 'select', options: AXIS_OPTIONS, default: 'none', when: (l) => !isField(l) },
    { key: 'animCycles', label: 'Sweep cycles', type: 'range', min: 1, max: 4, step: 1, default: 1, when: (l) => !isField(l) },
    { key: 'animWaves', label: 'Sweep waves', type: 'range', min: 0, max: 8, step: 0.5, default: 2, when: (l) => !isField(l) },
    { key: 'pulse', label: 'Pulse', type: 'range', min: 0, max: 1, step: 0.05, default: 0, when: (l) => !isField(l) },
    { key: 'fade', label: 'Fade', type: 'range', min: 0, max: 1, step: 0.05, default: 0, when: (l) => !isField(l) },
    { key: 'swing', label: 'Swing', type: 'range', min: 0, max: 180, step: 5, default: 0, when: isTiles },
    { key: 'colorMix', label: 'Colour mix', type: 'range', min: 0, max: 1, step: 0.05, default: 0, when: isTiles },
  ],
  defaults: {
    shape: DEFAULT_SHAPE_ID,
    customSvg: '',
    cols: 4,
    rows: 4,
    cell: 120,
    gap: 8,
    stretch: false,
    showGrid: false, // cell-boundary lattice overlay
    bg: '#0e0e11',
    color: '#fcfbf8',
    color2: '#c2502e',
    color3: '#3f6485',
    // Interleave the base fill across colours by cell index — the clean R/Y/B
    // "test grid" substrate. none | checker (2-col) | cols | rows | diag (3-col).
    colorRule: 'none',
    rules: [],
    // ── Field render (render:'field') — continuous vector pattern families
    // that bypass the tile loop. `field` picks the family; each reads the
    // palette (color/color2/color3 + bg).
    render: 'tiles',     // 'tiles' (tile loop) | 'field' (continuous field) | 'weave'
    field: 'stripes',    // active field family when render==='field'
    stripeAngle: 0,      // band direction (deg): 0 vertical · 90 horizontal · 45 diagonal
    stripePitch: 60,     // field units per band (band width / spacing)
    offsetX: 0,          // static position: shift across the bands (0..1 of a period)
    offsetY: 0,          // static position: shift along the bands (0..1 of a period)
    bandCount: 2,        // palette colours walked (1 single · 2 A/B · 3 A/B/C)
    duty: 1,             // 1 = solid bands; <1 = ink band width on the bg ground (pinstripe)
    edgeSoftness: 0,     // 0 = hard edge; >0 = soft / ombré blend
    // Tartan field (field:'tartan')
    sett: 'black-watch', // threadcount table (fields/setts.js)
    settScale: 5,        // px per thread unit
    twill: 0.18,         // 2/2-twill diagonal bias (0 = flat average)
    // Organic field (field:'organic') — bands with a wavy edge profile
    waveAmp: 0.4,        // undulation depth (× pitch)
    waveFreq: 1.5,       // waves across the field
    waveProfile: 'sine', // edge profile — see fields/organicField.js PROFILES ('custom' ⇒ waveCurve)
    waveCurve: null,     // baked bezier profile (labs ProfileEditor) when waveProfile==='custom'
    waveFlow: 0,         // organic: along-axis travel — the wave runs along the bands (whole cycles)
    fillMode: 'off',     // Split gaps: 'off' (ground shows) | 'extend' (bands meet) | 'solid' (fillColor)
    fillColor: '#101014',// ground colour when fillMode==='solid'
    // Form animation — PER-BAND (stripes/organic): each band moves individually.
    // Seamless on whole `fieldCycles`. 0 = off. (Field-wide scroll is the Frame axis.)
    fieldSway: 0,        // per-band position shift amount
    fieldStagger: 0,     // phase the sway across band index (×π ⇒ odd/even opposite at 1)
    fieldShimmer: 0,     // reserved (labs: per-band colour shimmer — not read by the renderers)
    fieldPulse: 0,       // reserved (labs: tartan sett-scale breathe — not read by the renderers)
    fieldCycles: 1,      // whole cycles per loop for the above
    // Weave render (render:'weave') — interlaced over/under strands
    weaveType: 'plain',  // plain | twill | satin | basket (which strand goes over)
    strandWidth: 0.7,    // ribbon width (× cell)
    camZoom: 1,
    camFlow: 1,
    camAngle: 0,
    panDir: 'diag', // pan direction: right|left|up|down|diag|anti (+ 'split' for band fields)
    spin: 0,
    // Animation sweep (per-cell, phased by world position).
    animAxis: 'none', // none | diag | col | row | radial
    animCycles: 1, // Speed: whole time cycles over the loop ⇒ seamless
    animWaves: 2, // Stagger: spatial phase offset of the sweep tile-to-tile
    pulse: 0, // 0..1 size breathe
    fade: 0, // 0..1 opacity sweep
    swing: 0, // 0..180 rotation sway (deg)
    colorMix: 0, // 0..1 colour sweep toward color2
  },
  draw(ctx, u, w, h, p) {
    ctx.fillStyle = p.bg
    ctx.fillRect(0, 0, w, h)

    // Render dispatch: field families bypass the tile loop entirely. 'tiles'
    // (default) falls through to the original engine below — Blocks' native case.
    if ((p.render || 'tiles') === 'field') return drawField(ctx, u, w, h, p)
    if (p.render === 'weave') return drawWeave(ctx, u, w, h, p)

    const shp = shapeFor(p.shape, p.customSvg)
    if (!shp.paths.length) return

    const [vx, vy, vw, vh] = shp.viewBox
    const cols = Math.max(1, p.cols | 0)
    const rows = Math.max(1, p.rows | 0)
    const cell = Math.max(8, p.cell)
    const period = cell + p.gap
    if (period <= 0) return
    const rulesKey = (p.rules || []).map(r => r.selectKind === 'expression' ? r.expression || '' : '_').join('|')
    if (!rulesCache || rulesCache.key !== rulesKey) rulesCache = { key: rulesKey, compiled: compileRules(p.rules) }
    const compiled = rulesCache.compiled

    const z = p.camZoom || 1
    const ang = (p.camAngle || 0) * Math.PI / 180
    const flow = Math.round(p.camFlow || 0)
    // Pan direction → per-axis block multipliers. All integer ⇒ whole blocks per
    // loop ⇒ seamless. 'diag' (1,1) reproduces the original down-right drift.
    const [fx, fy] = PAN_VEC[p.panDir] || PAN_VEC.diag
    const panX = u * flow * fx * cols * period
    const panY = u * flow * fy * rows * period
    const cellSpin = u * 360 * Math.round(p.spin || 0) // whole turns ⇒ seamless

    // Animation sweep params (resolved once per frame).
    const axis = p.animAxis || 'none'
    const animOn = axis !== 'none' && (p.pulse || p.fade || p.swing || p.colorMix)
    const cyc = Math.round(p.animCycles || 0)
    const wav = p.animWaves || 0
    const tphase = u * TAU * cyc

    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(ang)
    ctx.scale(z, z)
    ctx.translate(-panX, -panY)
    const baseMatrix = ctx.getTransform()

    // Pre-parse hex colors once so per-cell colorMix can inline-lerp without string parsing.
    const _c1 = hexToRgb(p.color)
    const _c2 = hexToRgb(p.color2 || p.color)
    const _c3 = hexToRgb(p.color3 || p.color2 || p.color)

    // World cells covering the (rotated, zoomed) viewport + margin.
    const reach = (Math.hypot(w, h) / 2) / z + period * 2
    const gx0 = Math.floor((panX - reach) / period)
    const gx1 = Math.ceil((panX + reach) / period)
    const gy0 = Math.floor((panY - reach) / period)
    const gy1 = Math.ceil((panY + reach) / period)

    let count = 0
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (++count > MAX_CELLS) { ctx.restore(); return }
        const col = ((gx % cols) + cols) % cols
        const row = ((gy % rows) + rows) % rows
        const i = row * cols + col
        const c = composeCell(p.rules, compiled, { row, col, cols, rows, i })
        if (c.hidden) continue

        // Per-cell base colour: an optional R/Y/B interleave by cell index (the
        // clean "test grid" substrate), else the single shape colour. Uses the
        // block-wrapped col/row so it stays seamless under camera flow.
        let baseColor = p.color
        const crule = p.colorRule
        if (crule && crule !== 'none') {
          if (crule === 'checker') baseColor = ((col + row) & 1) ? p.color2 : p.color
          else {
            const k3 = crule === 'cols' ? col : crule === 'rows' ? row : col + row
            const idx = ((k3 % 3) + 3) % 3
            baseColor = idx === 0 ? p.color : idx === 1 ? p.color2 : (p.color3 || p.color)
          }
        }

        // Per-cell animation from the sweep (seamless: u only via tphase).
        let aScale = 1
        let aOpacity = c.opacity
        let aRot = 0
        let aColor = baseColor
        if (animOn) {
          const sp = axis === 'col' ? gx
            : axis === 'row' ? gy
              : axis === 'radial' ? Math.hypot(gx, gy)
                : gx + gy
          const sw = Math.sin(tphase - sp * 0.5 * wav) // -1..1
          const k = 0.5 + 0.5 * sw // 0..1 — plain sine ⇒ symmetric, always seamless
          if (p.pulse) aScale = 1 - p.pulse + p.pulse * k
          if (p.fade) aOpacity = c.opacity * (1 - p.fade + p.fade * k)
          if (p.swing) aRot = p.swing * (2 * k - 1)
          if (p.colorMix) {
            const base = baseColor === p.color2 ? _c2 : baseColor === p.color3 ? _c3 : _c1
            const t = p.colorMix * k
            aColor = `rgb(${base[0]+t*(_c2[0]-base[0])|0},${base[1]+t*(_c2[1]-base[1])|0},${base[2]+t*(_c2[2]-base[2])|0})`
          }
        }

        ctx.translate(gx * period + cell / 2, gy * period + cell / 2)
        ctx.rotate((c.rotate + cellSpin + aRot) * Math.PI / 180)
        ctx.scale(c.scaleX * aScale, c.scaleY * aScale)
        const s = p.stretch ? null : Math.min(cell / vw, cell / vh)
        ctx.scale(p.stretch ? cell / vw : s, p.stretch ? cell / vh : s)
        ctx.translate(-vx - vw / 2, -vy - vh / 2)
        ctx.globalAlpha = aOpacity
        ctx.fillStyle = aColor
        for (const path of shp.paths) ctx.fill(path)
        ctx.setTransform(baseMatrix)
        ctx.globalAlpha = 1
      }
    }

    // Cell-boundary lattice (overlay, follows the camera; pans whole blocks ⇒
    // seamless). Drawn at the gap midpoints between cells.
    if (p.showGrid) {
      ctx.globalAlpha = 0.18
      ctx.strokeStyle = p.color
      ctx.lineWidth = 1
      const x0 = gx0 * period - p.gap / 2
      const x1 = (gx1 + 1) * period - p.gap / 2
      const y0 = gy0 * period - p.gap / 2
      const y1 = (gy1 + 1) * period - p.gap / 2
      ctx.beginPath()
      for (let gx = gx0; gx <= gx1 + 1; gx++) {
        const x = gx * period - p.gap / 2
        ctx.moveTo(x, y0)
        ctx.lineTo(x, y1)
      }
      for (let gy = gy0; gy <= gy1 + 1; gy++) {
        const y = gy * period - p.gap / 2
        ctx.moveTo(x0, y)
        ctx.lineTo(x1, y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.restore()
    ctx.globalAlpha = 1
  },
}
