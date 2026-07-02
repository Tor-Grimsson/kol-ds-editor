// Kinetic-type presets — the 10 curated TYPE compositions from kol-labs-single
// src/pages/type/registry.js (the acre_studio "type on a path, rotating"
// family): radial sunbursts, concentric-ring vortices, and single-path loops,
// plus the blank /type template — and the 14 KINETIC Scenes/Elements
// representatives (see the Labs ports section below). Each entry's `comp` is a
// full engine composition ({ bg, instances }) — stored OPAQUELY on the layer as
// `layer.comp` (like loop `forms`), so it rides history/autosave as one value.

import { fontByKey, defaultVf } from './fonts.js'
import { PATH_DEFAULTS } from './paths.js'

const BG = '#0b0d12'      // near-black, like the reel
const FG = '#e8e4dc'

const INSTANCE_DEFAULTS = {
  text: 'Kinetic',
  font: 'gullhamrar',
  fontSize: 120,
  fill: '#e8e4dc',
  italic: false,
  case: 'none',             // none | upper | lower | title (content-layer transform)
  letterSpacing: 0,
  align: 'center',
  multiply: 1,              // render N copies of the word in one instance
  flow: 'flow',             // 'flow' = type ignores the frame edges · 'contain' = kept inside
  offset: { x: 0, y: 0 },   // normalized position offset from frame centre
  phase: 0,                 // per-instance time shift (u offset 0..1) — editor extension
  stagger: 0,               // desync across the instance's repeated strings (0..1) — editor extension
  vf: {},
  opentype: {},
  showPath: false,
  path: { type: 'line', ...PATH_DEFAULTS },
  motion: { mode: 'none', cycles: 1, phase: 0.5, amp: 0.3, axis: 'wght', field: 'x' },
  motions: [],              // additional motion layers, composed on top of `motion`
}

// vf restricted to the font's axes, missing ones filled with the axis default.
export function normalizeVf(fontKey, vf = {}) {
  const font = fontByKey(fontKey)
  const out = defaultVf(font)
  for (const a of font.axes) if (vf[a.tag] != null) out[a.tag] = vf[a.tag]
  return out
}

// Merge one partial instance over INSTANCE_DEFAULTS (id assigned if absent).
function mergeInstance(p = {}, i = 0) {
  const out = {
    id: p.id || `i${i}`,
    ...INSTANCE_DEFAULTS,
    ...p,
    path: { ...INSTANCE_DEFAULTS.path, ...(p.path || {}) },
    motion: { ...INSTANCE_DEFAULTS.motion, ...(p.motion || {}) },
    motions: Array.isArray(p.motions) ? p.motions.map((mm) => ({ ...INSTANCE_DEFAULTS.motion, ...mm })) : [],
    offset: { ...INSTANCE_DEFAULTS.offset, ...(p.offset || {}) },
    opentype: { ...(p.opentype || {}) },
  }
  out.vf = normalizeVf(out.font, p.vf)
  return out
}

const comp = (o) => ({ bg: BG, instances: [mergeInstance({ font: 'rot', fill: FG, ...o }, 0)] })

// Labs comps (the Scenes/Elements ports below) keep the labs frame default bg
// and plain INSTANCE_DEFAULTS (gullhamrar / #e8e4dc) — unlike `comp`, which
// presets the TYPE family's rot/FG house style.
const LABS_BG = '#16202E'
const lab = (...insts) => ({ bg: LABS_BG, instances: insts.map((p, i) => mergeInstance(p, i)) })

export const KINETIC_PRESETS = [
  // ── Radial sunburst (reel frames 5–11) ──
  { id: 'sunburst', label: 'Sunburst', sub: 'Radial',
    comp: comp({ text: 'Without a soul, is it a place?', fontSize: 26, vf: { wdth: 100, wght: 500 }, path: { type: 'radial', count: 14, inner: 0.1, spin: 1 } }) },
  { id: 'dense-burst', label: 'Dense burst', sub: 'Radial',
    comp: comp({ text: 'is it a place', fontSize: 30, vf: { wdth: 90, wght: 600 }, path: { type: 'radial', count: 28, inner: 0.06, spin: 1 } }) },
  { id: 'double-twirl', label: 'Double twirl', sub: 'Radial',
    comp: comp({ text: 'turning and turning', fontSize: 24, font: 'malromur', vf: { wght: 500 }, path: { type: 'radial', count: 18, inner: 0.12, spin: 2 } }) },
  { id: 'pulse-burst', label: 'Pulse burst', sub: 'Radial',
    comp: comp({ text: 'breathe in, breathe out', fontSize: 26, font: 'gullhamrar', vf: { wght: 600 }, path: { type: 'radial', count: 16, inner: 0.1, spin: 1 }, motion: { mode: 'cascade', cycles: 2, phase: 0.5 } }) },
  // ── Concentric-ring vortex (reel frames 13–18) ──
  { id: 'vortex', label: 'Vortex', sub: 'Rings',
    comp: comp({ text: 'Does a community make a place? ', fontSize: 24, vf: { wdth: 100, wght: 500 }, path: { type: 'rings', count: 12, inner: 0.1, radius: 0.94, spin: 1, twist: 0.6, grow: 0.8 } }) },
  { id: 'galaxy', label: 'Galaxy', sub: 'Rings',
    comp: comp({ text: 'spiralling inward forever ', fontSize: 22, font: 'malromur', vf: { wght: 500 }, path: { type: 'rings', count: 16, inner: 0.05, radius: 0.96, spin: 1, twist: 1.25, grow: 0.9 } }) },
  { id: 'wide-rings', label: 'Wide rings', sub: 'Rings',
    comp: comp({ text: 'around and around ', fontSize: 28, font: 'gullhamrar', vf: { wght: 600 }, path: { type: 'rings', count: 8, inner: 0.18, radius: 0.92, spin: 1, twist: 0.3, grow: 1.2 } }) },
  // ── Single ring + spiral ──
  { id: 'orbit', label: 'Orbit', sub: 'Path',
    comp: comp({ text: 'KOLKRABBI · REYKJAVIK · ', fontSize: 40, font: 'malromur', vf: { wght: 500 }, path: { type: 'circle', radius: 0.82 }, motion: { mode: 'orbit', cycles: 1 } }) },
  { id: 'spiral', label: 'Spiral', sub: 'Path',
    comp: comp({ text: 'into the spiral we go ', fontSize: 30, vf: { wdth: 100, wght: 500 }, path: { type: 'spiral', turns: 4, radius: 0.95 }, motion: { mode: 'march', cycles: 1 } }) },
  // ── Template — the blank /type canvas (a single line instance) ──
  { id: 'template', label: 'Template', sub: 'Path',
    comp: comp({ text: 'Type here', fontSize: 160, vf: { wdth: 100, wght: 600 } }) },

  // ── Labs ports — the KINETIC Scenes/Elements representatives from
  // kol-labs-single src/pages/kinetic (data/presets.js × scenes/groups.js):
  // one comp per scene aesthetic and per element building block. Ids keep the
  // labs preset ids (provenance); labels take the group names.
  // DROPPED: the six morph-* presets (the morph render mode — opentype.js
  // glyph-outline interpolation — is not ported), so the Morph scene is
  // represented by a vfwave member instead.
  // FONT SUBS: jetbrains (mono, file not shipped) → rot condensed (wdth 90);
  // ordspor (not shipped) avoided entirely by representative choice.

  // ── Scenes (visual aesthetic) ──
  { id: 'big-statement', label: 'Flood', sub: 'Scenes', // labs 'Statement' (fontSize 240 → 220, the knob ceiling)
    comp: lab({ text: 'BIG', font: 'rot', fontSize: 220, vf: { wdth: 140, wght: 100 }, fill: '#c2502e', motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }) },
  { id: 'ring-and-word', label: 'Ring', sub: 'Scenes', // labs 'Ring + word' — multi-instance
    comp: lab(
      { id: 'a', text: 'KOLKRABBI · REYKJAVIK · ', font: 'malromur', fontSize: 56, vf: { wght: 500 }, fill: '#9ec1ff', path: { type: 'circle', radius: 0.86 }, motion: { mode: 'orbit', cycles: 1 } },
      { id: 'b', text: 'KOL', font: 'gullhamrar', fontSize: 180, vf: { wght: 800 }, fill: '#e8e4dc', path: { type: 'line' } },
    ) },
  { id: 'custom-s', label: 'Flow', sub: 'Scenes', // labs 'Custom S' — freeform Catmull-Rom path, path shown
    comp: lab({ text: 'freeform', fontSize: 96, vf: { wght: 600 }, path: { type: 'custom' }, showPath: true }) },
  { id: 'malromur-wave', label: 'Morph', sub: 'Scenes', // labs 'Malromur wave' (the morph-render presets are dropped)
    comp: lab({ text: 'Malromur', font: 'malromur', fontSize: 132, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.5 } }) },
  { id: 'flag', label: 'Wave', sub: 'Scenes', // labs 'Flag'
    comp: lab({ text: 'flag', font: 'rot', fontSize: 168, vf: { wdth: 120, wght: 600 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.5, amp: 0.5 } }) },
  { id: 'sweep-grid', label: 'Reveal', sub: 'Scenes', // labs 'Grid sweep' — font jetbrains → rot condensed
    comp: lab({ text: 'KOL', font: 'rot', fontSize: 56, vf: { wdth: 90, wght: 500 }, fill: '#7fd1ff', path: { type: 'array', rows: 4, cols: 5 }, motion: { mode: 'sweep', field: 'diagonal', cycles: 1, amp: 0.3 } }) },

  // ── Elements (structural building block) ──
  { id: 'baseline', label: 'Baseline', sub: 'Elements',
    comp: lab({ text: 'Typography', fontSize: 120, vf: { wght: 500 } }) },
  { id: 'arc-kinetic', label: 'Arcs', sub: 'Elements', // labs 'Arc'
    comp: lab({ text: 'Kinetic', fontSize: 130, vf: { wght: 600 }, path: { type: 'arc', amp: 0.45 } }) },
  { id: 'ellipse-loop', label: 'Loops', sub: 'Elements', // labs 'Ellipse'
    comp: lab({ text: 'REYKJAVIK', font: 'rot', fontSize: 78, vf: { wdth: 120, wght: 600 }, path: { type: 'ellipse', radius: 0.92 }, motion: { mode: 'orbit' } }) },
  { id: 'zigzag', label: 'Angular', sub: 'Elements', // labs 'Zigzag'
    comp: lab({ text: 'ZIGZAG', font: 'malromur', fontSize: 92, vf: { wght: 700 }, path: { type: 'zigzag', amp: 0.5, freq: 3 } }) },
  { id: 'array-grid', label: 'Grid', sub: 'Elements', // labs 'Grid'
    comp: lab({ text: 'KOL', fontSize: 64, vf: { wght: 600 }, path: { type: 'array', rows: 3, cols: 4 } }) },
  { id: 'weight-pulse', label: 'Weight', sub: 'Elements', // labs 'Weight pulse'
    comp: lab({ text: 'WEIGHT', fontSize: 150, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }) },
  { id: 'rot-width', label: 'Width', sub: 'Elements', // labs 'Rot width'
    comp: lab({ text: 'WIDTH', font: 'rot', fontSize: 150, vf: { wdth: 64, wght: 600 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 1, phase: 0.6 } }) },
  { id: 'cascade', label: 'Cascade', sub: 'Elements',
    comp: lab({ text: 'CASCADE', fontSize: 130, vf: { wght: 600 }, motion: { mode: 'cascade', cycles: 1, phase: 0.6 } }) },
]

export const kineticPresetById = (id) => KINETIC_PRESETS.find((p) => p.id === id) || KINETIC_PRESETS[0]

// Deep copy so layer edits never mutate the preset constants.
export const presetComp = (preset) => structuredClone(preset.comp)
