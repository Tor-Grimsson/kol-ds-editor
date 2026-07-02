// Kinetic knob schema — the editor's tractable control surface over a kinetic
// composition (r3: expose more parameters + per-string stagger + randomise).
//
// Declarative like the params schemas (tab / section / when-gates), but get/
// set are PURE COMP TRANSFORMS instead of flat layer props: the composition
// rides opaquely on `layer.comp` (state.jsx stores it whole, presets reset it
// wholesale), so knobs read and patch it directly. Mirroring knob values as
// flat layer props for AutoControls would create a second source of truth
// that desyncs on every preset switch — this is why KineticFields renders
// these itself instead of going through AutoControls.
//
// Knobs address the PRIMARY instance (instances[0]) — the preset-player
// model — except `stagger`, which fans out across all instances (instance i
// of N also gets phase = i/N · stagger, so stacked instances desync too).
//
// `rMin`/`rMax` bound randomise rolls tighter than the slider range;
// `noRandom` opts a knob out entirely (colors, font, text-shaped choices).

import { FONT_OPTIONS, fontByKey } from './fonts.js'
import { normalizeVf } from './presets.js'

const first = (c) => c?.instances?.[0] ?? null
const patchInst = (c, partial) =>
  ({ ...c, instances: (c.instances ?? []).map((x, i) => (i === 0 ? { ...x, ...partial } : x)) })
const patchAll = (c, fn) =>
  ({ ...c, instances: (c.instances ?? []).map((x, i, arr) => ({ ...x, ...fn(x, i, arr.length) })) })
const patchPath = (c, partial) => patchInst(c, { path: { ...(first(c)?.path ?? {}), ...partial } })
const patchMotion = (c, partial) => patchInst(c, { motion: { ...(first(c)?.motion ?? {}), ...partial } })
const ptype = (c) => first(c)?.path?.type ?? 'line'
const mode = (c) => first(c)?.motion?.mode ?? 'none'
const onPath = (c) => !['radial', 'rings', 'array'].includes(ptype(c))

export const KINETIC_KNOBS = [
  // ── Style ──
  { key: 'bg', label: 'Background', tab: 'style', type: 'color', noRandom: true,
    get: (c) => c.bg, set: (c, v) => ({ ...c, bg: v }) },
  { key: 'fill', label: 'Fill', tab: 'style', type: 'color', noRandom: true,
    get: (c) => first(c)?.fill, set: (c, v) => patchInst(c, { fill: v }) },
  { key: 'font', label: 'Font', tab: 'style', type: 'select', options: FONT_OPTIONS, noRandom: true,
    get: (c) => first(c)?.font,
    set: (c, v) => patchInst(c, { font: v, vf: normalizeVf(v, first(c)?.vf) }) },
  { key: 'fontSize', label: 'Font size', tab: 'style', type: 'range', min: 8, max: 220, step: 1, rMin: 36, rMax: 150,
    get: (c) => first(c)?.fontSize ?? 26, set: (c, v) => patchInst(c, { fontSize: Math.round(v) }) },
  { key: 'letterSpacing', label: 'Letter spacing', tab: 'style', type: 'range', min: -10, max: 40, step: 0.5, rMin: 0, rMax: 12,
    get: (c) => first(c)?.letterSpacing ?? 0, set: (c, v) => patchInst(c, { letterSpacing: v }) },
  { key: 'multiply', label: 'Copies', tab: 'style', type: 'range', min: 1, max: 6, step: 1, noRandom: true, when: onPath,
    get: (c) => first(c)?.multiply ?? 1, set: (c, v) => patchInst(c, { multiply: Math.round(v) }) },

  // ── Style · arrangement (when-gated per path type) ──
  { key: 'spokes', label: 'Spokes', tab: 'style', section: 'Arrangement', type: 'range', min: 2, max: 32, step: 1, rMin: 6, rMax: 28,
    when: (c) => ptype(c) === 'radial',
    get: (c) => first(c)?.path?.count ?? 12, set: (c, v) => patchPath(c, { count: Math.round(v) }) },
  { key: 'rings', label: 'Rings', tab: 'style', section: 'Arrangement', type: 'range', min: 2, max: 24, step: 1, rMin: 4, rMax: 16,
    when: (c) => ptype(c) === 'rings',
    get: (c) => first(c)?.path?.count ?? 12, set: (c, v) => patchPath(c, { count: Math.round(v) }) },
  { key: 'inner', label: 'Inner radius', tab: 'style', section: 'Arrangement', type: 'range', min: 0, max: 0.9, step: 0.01, rMin: 0.04, rMax: 0.4,
    when: (c) => ptype(c) === 'radial' || ptype(c) === 'rings',
    get: (c) => first(c)?.path?.inner ?? 0.12, set: (c, v) => patchPath(c, { inner: v }) },
  { key: 'ringRadius', label: 'Radius', tab: 'style', section: 'Arrangement', type: 'range', min: 0.1, max: 1, step: 0.01, rMin: 0.6, rMax: 1,
    when: (c) => ptype(c) === 'rings',
    get: (c) => first(c)?.path?.radius ?? 0.92, set: (c, v) => patchPath(c, { radius: v }) },
  { key: 'twist', label: 'Twist', tab: 'style', section: 'Arrangement', type: 'range', min: 0, max: 2, step: 0.05, rMin: 0, rMax: 1.5,
    when: (c) => ptype(c) === 'rings',
    get: (c) => first(c)?.path?.twist ?? 0.5, set: (c, v) => patchPath(c, { twist: v }) },
  { key: 'grow', label: 'Grow', tab: 'style', section: 'Arrangement', type: 'range', min: 0, max: 2, step: 0.05, rMin: 0, rMax: 1.5,
    when: (c) => ptype(c) === 'rings',
    get: (c) => first(c)?.path?.grow ?? 0.6, set: (c, v) => patchPath(c, { grow: v }) },
  { key: 'pathRadius', label: 'Radius', tab: 'style', section: 'Arrangement', type: 'range', min: 0.2, max: 1, step: 0.01, rMin: 0.5, rMax: 1,
    when: (c) => ['circle', 'ellipse', 'spiral'].includes(ptype(c)),
    get: (c) => first(c)?.path?.radius ?? 0.72, set: (c, v) => patchPath(c, { radius: v }) },
  { key: 'turns', label: 'Turns', tab: 'style', section: 'Arrangement', type: 'range', min: 1, max: 6, step: 1, rMin: 2, rMax: 5,
    when: (c) => ptype(c) === 'spiral',
    get: (c) => first(c)?.path?.turns ?? 3, set: (c, v) => patchPath(c, { turns: Math.round(v) }) },
  { key: 'amp', label: 'Amplitude', tab: 'style', section: 'Arrangement', type: 'range', min: 0, max: 1, step: 0.05, rMin: 0.2, rMax: 0.7,
    when: (c) => ['arc', 'sine', 'zigzag'].includes(ptype(c)),
    get: (c) => first(c)?.path?.amp ?? 0.4, set: (c, v) => patchPath(c, { amp: v }) },
  { key: 'freq', label: 'Frequency', tab: 'style', section: 'Arrangement', type: 'range', min: 1, max: 6, step: 1, rMin: 1, rMax: 4,
    when: (c) => ['sine', 'zigzag'].includes(ptype(c)),
    get: (c) => first(c)?.path?.freq ?? 2, set: (c, v) => patchPath(c, { freq: Math.round(v) }) },
  { key: 'rows', label: 'Rows', tab: 'style', section: 'Arrangement', type: 'range', min: 1, max: 6, step: 1, rMin: 2, rMax: 4,
    when: (c) => ptype(c) === 'array',
    get: (c) => first(c)?.path?.rows ?? 2, set: (c, v) => patchPath(c, { rows: Math.round(v) }) },
  { key: 'cols', label: 'Columns', tab: 'style', section: 'Arrangement', type: 'range', min: 1, max: 8, step: 1, rMin: 2, rMax: 6,
    when: (c) => ptype(c) === 'array',
    get: (c) => first(c)?.path?.cols ?? 3, set: (c, v) => patchPath(c, { cols: Math.round(v) }) },

  // ── Animation ──
  { key: 'mode', label: 'Motion', tab: 'anim', type: 'select', noRandom: true, options: [
      { value: 'none', label: 'None' },
      { value: 'march', label: 'March' },
      { value: 'orbit', label: 'Orbit' },
      { value: 'vfwave', label: 'Axis wave' },
      { value: 'glyphwave', label: 'Glyph wave' },
      { value: 'cascade', label: 'Cascade' },
      { value: 'sweep', label: 'Sweep' },
      { value: 'sweepWeight', label: 'Sweep weight' },
      { value: 'sweepShift', label: 'Sweep shift' },
    ],
    get: mode, set: (c, v) => patchMotion(c, { mode: v }) },
  { key: 'cycles', label: 'Cycles', tab: 'anim', type: 'range', min: 1, max: 4, step: 1, rMin: 1, rMax: 3,
    when: (c) => mode(c) !== 'none',
    get: (c) => first(c)?.motion?.cycles ?? 1, set: (c, v) => patchMotion(c, { cycles: Math.round(v) }) },
  { key: 'motionAmp', label: 'Amount', tab: 'anim', type: 'range', min: 0.05, max: 1, step: 0.05, rMin: 0.15, rMax: 0.6,
    when: (c) => ['glyphwave', 'sweep', 'sweepWeight', 'sweepShift'].includes(mode(c)),
    get: (c) => first(c)?.motion?.amp ?? 0.3, set: (c, v) => patchMotion(c, { amp: v }) },
  { key: 'motionPhase', label: 'Glyph phase', tab: 'anim', type: 'range', min: 0, max: 1.5, step: 0.05, rMin: 0.3, rMax: 1,
    when: (c) => ['vfwave', 'glyphwave', 'cascade'].includes(mode(c)),
    get: (c) => first(c)?.motion?.phase ?? 0.5, set: (c, v) => patchMotion(c, { phase: v }) },
  { key: 'axis', label: 'Axis', tab: 'anim', type: 'select',
    when: (c) => ['vfwave', 'sweepWeight'].includes(mode(c)) && fontByKey(first(c)?.font).axes.length > 1,
    options: (c) => fontByKey(first(c)?.font).axes.map((a) => ({
      value: a.tag, label: a.tag === 'wght' ? 'Weight' : a.tag === 'wdth' ? 'Width' : a.tag })),
    get: (c) => first(c)?.motion?.axis ?? 'wght', set: (c, v) => patchMotion(c, { axis: v }) },
  { key: 'field', label: 'Field', tab: 'anim', type: 'select',
    when: (c) => ['sweep', 'sweepWeight', 'sweepShift'].includes(mode(c)), options: [
      { value: 'x', label: 'Horizontal' },
      { value: 'y', label: 'Vertical' },
      { value: 'diagonal', label: 'Diagonal' },
      { value: 'radial', label: 'Radial' },
      { value: 'angular', label: 'Angular' },
      { value: 'wave', label: 'Wave' },
    ],
    get: (c) => first(c)?.motion?.field ?? 'x', set: (c, v) => patchMotion(c, { field: v }) },
  /* The r3 headline: desync the repeated strings. Writes stagger to every
   * instance (per-unit desync inside each: spokes/rings/cells/copies) AND
   * distributes per-instance phase i/N·stagger so stacked instances shift
   * against each other. */
  { key: 'stagger', label: 'Stagger', tab: 'anim', type: 'range', min: 0, max: 1, step: 0.01,
    get: (c) => first(c)?.stagger ?? 0,
    set: (c, v) => patchAll(c, (x, i, n) => ({ stagger: v, phase: n > 1 ? (i / n) * v : 0 })) },
  { key: 'spin', label: 'Spin', tab: 'anim', type: 'range', min: 0, max: 4, step: 1, rMin: 0, rMax: 3,
    when: (c) => ptype(c) === 'radial' || ptype(c) === 'rings',
    get: (c) => first(c)?.path?.spin ?? 1, set: (c, v) => patchPath(c, { spin: Math.round(v) }) },
]

// options may be static or a fn of the comp (e.g. the font's axes).
export const knobOptions = (k, comp) => (typeof k.options === 'function' ? k.options(comp) : k.options ?? [])

// Roll every randomisable knob currently in play (when-gates evaluated against
// the progressively patched comp) — the LoopFields randomise idiom, comp-native.
export function randomiseComp(comp) {
  let next = comp
  for (const k of KINETIC_KNOBS) {
    if (k.noRandom || k.type === 'color') continue
    if (k.when && !k.when(next)) continue
    if (k.type === 'range') {
      const lo = k.rMin ?? k.min
      const hi = k.rMax ?? k.max
      const step = k.step ?? 1
      const raw = lo + Math.random() * (hi - lo)
      next = k.set(next, Math.min(hi, Math.max(lo, Number((Math.round(raw / step) * step).toFixed(4)))))
    } else if (k.type === 'select') {
      const opts = knobOptions(k, next)
      if (opts.length) next = k.set(next, opts[Math.floor(Math.random() * opts.length)].value)
    }
  }
  return next
}
