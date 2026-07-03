// Kinetic-type presets — the 10 curated TYPE compositions from kol-labs-single
// src/pages/type/registry.js (the acre_studio "type on a path, rotating"
// family): radial sunbursts, concentric-ring vortices, and single-path loops,
// plus the blank /type template — and the KINETIC catalog from Labs: the 14
// Scenes/Elements representatives plus the full backfill (see the Labs
// sections below). Each entry's `comp` is a
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
// Same as `lab` but with an explicit frame bg (labs presets that lift a bg).
const labBg = (bg, ...insts) => ({ bg, instances: insts.map((p, i) => mergeInstance(p, i)) })

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

  // ── Labs backfill — the rest of the kol-labs-single kinetic catalog (every
  // non-morph preset not already covered by the representatives above). Ids,
  // labels and configs are verbatim labs; `sub` takes the labs sub-taxonomy
  // (Lines/Curves/Closed/…), which is what the picker shows as the group
  // prefix. FONT SUBS (unshipped faces → rot condensed):
  //   jetbrains → rot { wdth: 90, wght: 500 } (the sweep-grid precedent);
  //   ordspor   → rot { wdth: 90 } keeping the labs wght (300 — ordspor's
  //   axis default — where the labs preset set none).

  // ── Path · Lines ──
  { id: 'baseline-mono', label: 'Mono line', sub: 'Lines', // font jetbrains → rot condensed
    comp: lab({ text: 'monospace', font: 'rot', fontSize: 110, vf: { wdth: 90, wght: 500 }, fill: '#7fd1ff' }) },
  { id: 'baseline-light', label: 'On paper', sub: 'Lines', // light frame (labs bg lift)
    comp: labBg('#f4f1ea', { text: 'Reykjavik', font: 'malromur', fontSize: 130, vf: { wght: 600 }, fill: '#0b0b0e' }) },

  // ── Path · Curves ──
  { id: 'sine-flow', label: 'Sine flow', sub: 'Curves', // font ordspor → rot condensed
    comp: lab({ text: 'wave along', font: 'rot', fontSize: 96, vf: { wdth: 90, wght: 500 }, path: { type: 'sine', amp: 0.4, freq: 2 }, motion: { mode: 'march', cycles: 1 } }) },
  { id: 'spiral-in', label: 'Spiral', sub: 'Curves',
    comp: lab({ text: 'spiral', fontSize: 88, vf: { wght: 700 }, path: { type: 'spiral', turns: 3 } }) },
  { id: 'arc-march', label: 'Arc march', sub: 'Curves',
    comp: lab({ text: 'on the arc', font: 'rot', fontSize: 96, vf: { wdth: 100, wght: 500 }, path: { type: 'arc', amp: 0.5 }, motion: { mode: 'march' } }) },
  { id: 'arc-up', label: 'High arc', sub: 'Curves',
    comp: lab({ text: 'over the top', font: 'malromur', fontSize: 92, vf: { wght: 600 }, path: { type: 'arc', amp: 0.7 } }) },
  { id: 'arc-wide', label: 'Wide arc', sub: 'Curves',
    comp: lab({ text: 'WIDEARC', font: 'rot', fontSize: 96, vf: { wdth: 150, wght: 600 }, path: { type: 'arc', amp: 0.4 } }) },
  { id: 'sine-fast', label: 'Fast wave', sub: 'Curves',
    comp: lab({ text: 'up and down', fontSize: 90, vf: { wght: 600 }, path: { type: 'sine', amp: 0.4, freq: 3 }, motion: { mode: 'march', cycles: 2 } }) },
  { id: 'sine-tall', label: 'Tall wave', sub: 'Curves', // font ordspor → rot condensed
    comp: lab({ text: 'rolling', font: 'rot', fontSize: 100, vf: { wdth: 90, wght: 500 }, path: { type: 'sine', amp: 0.6, freq: 2 } }) },
  { id: 'spiral-march', label: 'Spiral march', sub: 'Curves',
    comp: lab({ text: 'into the spiral', font: 'rot', fontSize: 72, vf: { wdth: 100, wght: 500 }, path: { type: 'spiral', turns: 5 }, motion: { mode: 'march', cycles: 1 } }) },

  // ── Path · Closed ──
  { id: 'circle-orbit', label: 'Circle', sub: 'Closed',
    comp: lab({ text: 'KOLKRABBI', font: 'malromur', fontSize: 80, vf: { wght: 500 }, path: { type: 'circle', radius: 0.72 }, motion: { mode: 'orbit', cycles: 1 } }) },
  { id: 'circle-big', label: 'Big circle', sub: 'Closed',
    comp: lab({ text: 'AROUND WE GO', fontSize: 76, vf: { wght: 600 }, path: { type: 'circle', radius: 0.85 }, motion: { mode: 'orbit' } }) },
  { id: 'circle-mono', label: 'Mono circle', sub: 'Closed', // font jetbrains → rot condensed
    comp: lab({ text: 'LOOP/LOOP/', font: 'rot', fontSize: 72, vf: { wdth: 90, wght: 500 }, fill: '#f6c453', path: { type: 'circle', radius: 0.78 }, motion: { mode: 'orbit' } }) },
  { id: 'ellipse-wide', label: 'Wide ellipse', sub: 'Closed',
    comp: lab({ text: 'ELLIPTICAL', font: 'malromur', fontSize: 74, vf: { wght: 500 }, path: { type: 'ellipse', radius: 1 }, motion: { mode: 'orbit' } }) },

  // ── Path · Angular ──
  { id: 'zigzag-fine', label: 'Fine zigzag', sub: 'Angular',
    comp: lab({ text: 'sawtooth', font: 'rot', fontSize: 80, vf: { wdth: 90, wght: 600 }, path: { type: 'zigzag', amp: 0.35, freq: 5 } }) },

  // ── Path · Custom ──
  { id: 'custom-march', label: 'Custom march', sub: 'Custom', // font ordspor → rot condensed
    comp: lab({ text: 'follow me', font: 'rot', fontSize: 90, vf: { wdth: 90, wght: 500 }, path: { type: 'custom' }, motion: { mode: 'march' } }) },

  // ── Variable · Weight ──
  { id: 'ordspor-pulse', label: 'Ordspor', sub: 'Weight', // font ordspor → rot condensed
    comp: lab({ text: 'Ordspor', font: 'rot', fontSize: 132, vf: { wdth: 90, wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.7 } }) },
  { id: 'rot-weight', label: 'Rot weight', sub: 'Weight',
    comp: lab({ text: 'ROT', font: 'rot', fontSize: 200, vf: { wdth: 120, wght: 100 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }) },
  { id: 'weight-slow', label: 'Slow weight', sub: 'Weight',
    comp: lab({ text: 'breathe', fontSize: 150, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.3 } }) },
  { id: 'weight-fast', label: 'Fast weight', sub: 'Weight',
    comp: lab({ text: 'PULSE', fontSize: 160, vf: { wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 3, phase: 0.6 } }) },
  { id: 'malromur-heavy', label: 'Heavy swing', sub: 'Weight', // light frame (labs bg lift)
    comp: labBg('#f4f1ea', { text: 'Malromur', font: 'malromur', fontSize: 130, vf: { wght: 300 }, fill: '#0b0b0e', motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }) },
  { id: 'ordspor-wave2', label: 'Ordspor ×2', sub: 'Weight', // font ordspor → rot condensed
    comp: lab({ text: 'twice', font: 'rot', fontSize: 150, vf: { wdth: 90, wght: 300 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.5 } }) },
  { id: 'rot-weight2', label: 'Rot weight ×2', sub: 'Weight',
    comp: lab({ text: 'ROT', font: 'rot', fontSize: 200, vf: { wdth: 120, wght: 100 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.4 } }) },
  { id: 'malromur-bigwave', label: 'Big wave', sub: 'Weight',
    comp: lab({ text: 'WEIGHT', font: 'malromur', fontSize: 150, vf: { wght: 300 }, fill: '#f6c453', motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.7 } }) },
  { id: 'ordspor-accent', label: 'Ordspor accent', sub: 'Weight', // font ordspor → rot condensed
    comp: lab({ text: 'Ordspor', font: 'rot', fontSize: 140, vf: { wdth: 90, wght: 300 }, fill: '#8f5ad0', motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }) },

  // ── Variable · Width ──
  { id: 'rot-dual', label: 'Variable', sub: 'Width',
    comp: lab({ text: 'variable', font: 'rot', fontSize: 124, vf: { wdth: 100, wght: 400 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 2, phase: 0.4 } }) },
  { id: 'rot-width-fast', label: 'Width ×2', sub: 'Width',
    comp: lab({ text: 'STRETCH', font: 'rot', fontSize: 130, vf: { wdth: 64, wght: 600 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 2, phase: 0.5 } }) },
  { id: 'rot-width-slow', label: 'Width slow', sub: 'Width',
    comp: lab({ text: 'expand', font: 'rot', fontSize: 130, vf: { wdth: 100, wght: 500 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 1, phase: 0.3 } }) },

  // ── Variable · On path ──
  { id: 'arc-weight', label: 'Morph on arc', sub: 'On path',
    comp: lab({ text: 'morph', fontSize: 120, path: { type: 'arc', amp: 0.3 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }) },
  { id: 'sine-weight', label: 'Wave + weight', sub: 'On path',
    comp: lab({ text: 'modulated', fontSize: 92, vf: { wght: 400 }, path: { type: 'sine', amp: 0.3, freq: 2 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } }) },
  { id: 'circle-weight', label: 'Ring + weight', sub: 'On path',
    comp: lab({ text: 'ROTATING', font: 'malromur', fontSize: 78, vf: { wght: 300 }, path: { type: 'circle', radius: 0.74 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 2, phase: 0.6 } }) },
  { id: 'arc-width', label: 'Arc + width', sub: 'On path',
    comp: lab({ text: 'arcwidth', font: 'rot', fontSize: 96, vf: { wdth: 80, wght: 600 }, path: { type: 'arc', amp: 0.4 }, motion: { mode: 'vfwave', axis: 'wdth', cycles: 1, phase: 0.5 } }) },

  // ── Motion · Reveal ──
  { id: 'pop', label: 'Pop', sub: 'Reveal',
    comp: lab({ text: 'POP POP', fontSize: 130, vf: { wght: 800 }, motion: { mode: 'cascade', cycles: 2, phase: 0.8 } }) },
  { id: 'arc-cascade', label: 'Curve cascade', sub: 'Reveal', // font ordspor → rot condensed
    comp: lab({ text: 'on a curve', font: 'rot', fontSize: 100, vf: { wdth: 90, wght: 500 }, path: { type: 'arc', amp: 0.4 }, motion: { mode: 'cascade', cycles: 1, phase: 0.5 } }) },
  { id: 'cascade-slow', label: 'Slow cascade', sub: 'Reveal',
    comp: lab({ text: 'unfold', fontSize: 130, vf: { wght: 600 }, motion: { mode: 'cascade', cycles: 1, phase: 0.4 } }) },
  { id: 'cascade-fast', label: 'Fast cascade', sub: 'Reveal',
    comp: lab({ text: 'flicker', fontSize: 130, vf: { wght: 700 }, motion: { mode: 'cascade', cycles: 2, phase: 0.7 } }) },
  { id: 'typewriter', label: 'Typewriter', sub: 'Reveal', // font jetbrains → rot condensed
    comp: lab({ text: 'type_type_', font: 'rot', fontSize: 100, vf: { wdth: 90, wght: 500 }, fill: '#7fd1ff', motion: { mode: 'cascade', cycles: 1, phase: 1 } }) },
  { id: 'spiral-cascade', label: 'Spiral reveal', sub: 'Reveal',
    comp: lab({ text: 'spiral down', fontSize: 74, vf: { wght: 600 }, path: { type: 'spiral', turns: 3 }, motion: { mode: 'cascade', cycles: 1, phase: 0.5 } }) },
  { id: 'circle-cascade', label: 'Ring reveal', sub: 'Reveal',
    comp: lab({ text: 'AROUND', font: 'malromur', fontSize: 86, vf: { wght: 600 }, path: { type: 'circle', radius: 0.74 }, motion: { mode: 'cascade', cycles: 1, phase: 0.6 } }) },
  { id: 'pop-mono', label: 'Mono pop', sub: 'Reveal', // font jetbrains → rot condensed
    comp: lab({ text: 'POP.POP.', font: 'rot', fontSize: 110, vf: { wdth: 90, wght: 500 }, fill: '#f6c453', motion: { mode: 'cascade', cycles: 2, phase: 0.8 } }) },

  // ── Motion · Wave ──
  { id: 'glyph-wave', label: 'Ripple', sub: 'Wave',
    comp: lab({ text: 'ripple', font: 'malromur', fontSize: 140, vf: { wght: 600 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.6, amp: 0.4 } }) },
  { id: 'sine-ripple', label: 'Sine ripple', sub: 'Wave',
    comp: lab({ text: 'wavewave', font: 'rot', fontSize: 108, vf: { wdth: 110, wght: 600 }, path: { type: 'sine', amp: 0.3, freq: 2 }, motion: { mode: 'glyphwave', amp: 0.3 } }) },
  { id: 'glyph-big', label: 'Big ripple', sub: 'Wave',
    comp: lab({ text: 'WAVES', fontSize: 150, vf: { wght: 700 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.6, amp: 0.6 } }) },
  { id: 'glyph-fast', label: 'Fast ripple', sub: 'Wave',
    comp: lab({ text: 'shiver', font: 'malromur', fontSize: 140, vf: { wght: 600 }, motion: { mode: 'glyphwave', cycles: 2, phase: 0.5, amp: 0.35 } }) },
  { id: 'arc-glyphwave', label: 'Arc ripple', sub: 'Wave', // font ordspor → rot condensed
    comp: lab({ text: 'on a curve', font: 'rot', fontSize: 96, vf: { wdth: 90, wght: 500 }, path: { type: 'arc', amp: 0.4 }, motion: { mode: 'glyphwave', amp: 0.3 } }) },
  { id: 'rot-flag-fast', label: 'Rot flag', sub: 'Wave',
    comp: lab({ text: 'flutter', font: 'rot', fontSize: 150, vf: { wdth: 120, wght: 600 }, motion: { mode: 'glyphwave', cycles: 2, phase: 0.5, amp: 0.5 } }) },
  { id: 'sine-ripple2', label: 'Sine flutter', sub: 'Wave', // font ordspor → rot condensed
    comp: lab({ text: 'flowflow', font: 'rot', fontSize: 100, vf: { wdth: 90, wght: 500 }, path: { type: 'sine', amp: 0.3, freq: 2 }, motion: { mode: 'glyphwave', cycles: 2, amp: 0.3 } }) },

  // ── Motion · Sweep ──
  { id: 'sweep-x', label: 'Sweep X', sub: 'Sweep',
    comp: lab({ text: 'SWEEP', fontSize: 150, vf: { wght: 700 }, motion: { mode: 'sweep', field: 'x', cycles: 1, amp: 0.3 } }) },
  { id: 'sweep-y', label: 'Sweep Y', sub: 'Sweep', // font ordspor → rot condensed
    comp: lab({ text: 'descend', font: 'rot', fontSize: 130, vf: { wdth: 90, wght: 500 }, motion: { mode: 'sweep', field: 'y', cycles: 1, amp: 0.35 } }) },
  { id: 'sweep-radial', label: 'Radial pulse', sub: 'Sweep',
    comp: lab({ text: 'PULSE', font: 'malromur', fontSize: 140, vf: { wght: 600 }, motion: { mode: 'sweep', field: 'radial', cycles: 1, amp: 0.4 } }) },
  { id: 'sweep-weight', label: 'Sweep weight', sub: 'Sweep',
    comp: lab({ text: 'WEIGHT', fontSize: 150, vf: { wght: 300 }, motion: { mode: 'sweepWeight', field: 'x', cycles: 1, amp: 0.4 } }) },
  { id: 'sweep-shift', label: 'Sweep shift', sub: 'Sweep',
    comp: lab({ text: 'shiver', font: 'rot', fontSize: 130, vf: { wdth: 110, wght: 600 }, motion: { mode: 'sweepShift', field: 'wave', cycles: 1, amp: 0.3 } }) },

  // ── Motion · Orbit ──
  { id: 'orbit-spin', label: 'Orbit', sub: 'Orbit',
    comp: lab({ text: 'ORBIT', font: 'malromur', fontSize: 88, vf: { wght: 600 }, path: { type: 'circle', radius: 0.7 }, motion: { mode: 'orbit', cycles: 1 } }) },
  { id: 'orbit-fast', label: 'Fast orbit', sub: 'Orbit',
    comp: lab({ text: 'spinning', fontSize: 84, vf: { wght: 600 }, path: { type: 'circle', radius: 0.72 }, motion: { mode: 'orbit', cycles: 2 } }) },
  { id: 'ellipse-orbit', label: 'Ellipse orbit', sub: 'Orbit',
    comp: lab({ text: 'ORBITAL', font: 'rot', fontSize: 78, vf: { wdth: 110, wght: 600 }, path: { type: 'ellipse', radius: 0.95 }, motion: { mode: 'orbit', cycles: 1 } }) },

  // ── Array (grid) ──
  { id: 'array-pulse', label: 'Grid pulse', sub: 'Array', // font jetbrains → rot condensed
    comp: lab({ text: 'NODE', font: 'rot', fontSize: 44, vf: { wdth: 90, wght: 500 }, fill: '#7fd1ff', path: { type: 'array', rows: 4, cols: 5 }, motion: { mode: 'cascade', cycles: 1, phase: 0.5 } }) },
  { id: 'array-wave', label: 'Grid wave', sub: 'Array', // font ordspor → rot condensed
    comp: lab({ text: 'echo', font: 'rot', fontSize: 52, vf: { wdth: 90, wght: 500 }, path: { type: 'array', rows: 3, cols: 3 }, motion: { mode: 'glyphwave', cycles: 1, phase: 0.7, amp: 0.4 } }) },
  { id: 'array-weight', label: 'Grid weight', sub: 'Array',
    comp: lab({ text: 'OK', font: 'rot', fontSize: 88, vf: { wdth: 100, wght: 200 }, path: { type: 'array', rows: 2, cols: 3 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.6 } }) },

  // ── Composite (multi-instance) ──
  { id: 'stacked', label: 'Stacked', sub: 'Composite', // instance b: font ordspor → rot condensed
    comp: lab(
      { id: 'a', text: 'KINETIC', font: 'gullhamrar', fontSize: 130, vf: { wght: 700 }, fill: '#e8e4dc', path: { type: 'line', offset: -0.16 } },
      { id: 'b', text: 'typography', font: 'rot', fontSize: 90, vf: { wdth: 90, wght: 400 }, fill: '#f6c453', path: { type: 'line', offset: 0.16 }, motion: { mode: 'vfwave', axis: 'wght', cycles: 1, phase: 0.5 } },
    ) },
  { id: 'grid-and-ring', label: 'Grid + ring', sub: 'Composite', // instance a: font jetbrains → rot condensed
    comp: labBg('#0a0b14',
      { id: 'a', text: 'echo', font: 'rot', fontSize: 40, vf: { wdth: 90, wght: 500 }, fill: '#3a4a6a', path: { type: 'array', rows: 4, cols: 5 } },
      { id: 'b', text: 'SIGNAL · SIGNAL · ', font: 'rot', fontSize: 60, vf: { wdth: 110, wght: 600 }, fill: '#9ec1ff', path: { type: 'circle', radius: 0.7 }, motion: { mode: 'orbit', cycles: 1 } },
    ) },
]

export const kineticPresetById = (id) => KINETIC_PRESETS.find((p) => p.id === id) || KINETIC_PRESETS[0]

// Deep copy so layer edits never mutate the preset constants.
export const presetComp = (preset) => structuredClone(preset.comp)
