// Kinetic knob schema — the editor's tractable control surface over a kinetic
// composition (r3: expose more parameters + per-string stagger + randomise;
// r4: per-element editing — every transform takes an instance index).
//
// Declarative like the params schemas (tab / section / when-gates), but get/
// set are PURE COMP TRANSFORMS instead of flat layer props: the composition
// rides opaquely on `layer.comp` (state.jsx stores it whole, presets reset it
// wholesale), so knobs read and patch it directly. Mirroring knob values as
// flat layer props for AutoControls would create a second source of truth
// that desyncs on every preset switch — this is why KineticPanel renders
// these itself instead of going through AutoControls.
//
// Knobs address the SELECTED instance: get/set/when/options all take an
// instance index `i` (default 0 — the old primary-instance calls keep
// working unchanged). Frame-level knobs (`bg`) ignore it; `stagger` fans out
// across all instances (instance i of N also gets phase = i/N · stagger, so
// stacked instances desync too).
//
// `rMin`/`rMax` bound randomise rolls tighter than the slider range;
// `noRandom` opts a knob out entirely (colors, font, text-shaped choices).

import { FONT_OPTIONS, fontByKey } from './fonts.js'
import { normalizeVf } from './presets.js'
import { CURVE_OPTIONS, MORPH_MODE_OPTIONS } from './morph.js'

const inst = (c, i = 0) => c?.instances?.[i] ?? null
const patchInst = (c, partial, i = 0) =>
  ({ ...c, instances: (c.instances ?? []).map((x, j) => (j === i ? { ...x, ...partial } : x)) })
const patchAll = (c, fn) =>
  ({ ...c, instances: (c.instances ?? []).map((x, i, arr) => ({ ...x, ...fn(x, i, arr.length) })) })
const patchPath = (c, partial, i = 0) => patchInst(c, { path: { ...(inst(c, i)?.path ?? {}), ...partial } }, i)
const patchMotion = (c, partial, i = 0) => patchInst(c, { motion: { ...(inst(c, i)?.motion ?? {}), ...partial } }, i)
const ptype = (c, i = 0) => inst(c, i)?.path?.type ?? 'line'
const mode = (c, i = 0) => inst(c, i)?.motion?.mode ?? 'none'
const onPath = (c, i = 0) => !['radial', 'rings', 'array'].includes(ptype(c, i))

// Arrangement families — the engine's placed modes (array/radial/rings) plus
// every buildPath type (paths.js).
const ARRANGEMENT_OPTIONS = [
  { value: 'line',   label: 'Line' },
  { value: 'arc',    label: 'Arc' },
  { value: 'sine',   label: 'Sine' },
  { value: 'zigzag', label: 'Zigzag' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'circle', label: 'Circle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'custom', label: 'Custom' },
  { value: 'array',  label: 'Array' },
  { value: 'radial', label: 'Radial' },
  { value: 'rings',  label: 'Rings' },
]

// ── morph helpers (the glyph-outline interpolation surface — see morph.js) ──
const morph = (c, i = 0) => inst(c, i)?.morph ?? {}
const patchMorph = (c, partial, i = 0) => patchInst(c, { morph: { ...(inst(c, i)?.morph ?? {}), ...partial } }, i)
const patchMorphVf2 = (c, tag, v, i = 0) => patchMorph(c, { vf2: { ...(morph(c, i).vf2 ?? {}), [tag]: v } }, i)
const canMorph = (c, i = 0) => !['radial', 'rings'].includes(ptype(c, i)) // radial/rings are <text>-only (labs rule)
const morphOn = (c, i = 0) => canMorph(c, i) && !!morph(c, i).on
const morphMode = (c, i = 0) => morph(c, i).mode ?? 'morph'
const cutB = (c, i = 0) => morphOn(c, i) && ['morph', 'fade'].includes(morphMode(c, i)) // Cut B applies to morph/fade
const axisOf = (c, tag, i = 0) => fontByKey(inst(c, i)?.font).axes.find((a) => a.tag === tag)
// Cut B axis writes clamp to the instance font's real axis range (knob min/max
// are static schema numbers; the fonts' ranges differ — e.g. wght 100..900 on
// rot vs 300..900 on malromur/gullhamrar).
const setMorphAxis = (c, tag, v, i = 0) => {
  const a = axisOf(c, tag, i)
  const clamped = a ? Math.min(a.max, Math.max(a.min, v)) : v
  return patchMorphVf2(c, tag, Math.round(clamped), i)
}

export const KINETIC_KNOBS = [
  // ── Style ──
  { key: 'bg', label: 'Background', tab: 'style', type: 'color', noRandom: true,
    get: (c) => c.bg, set: (c, v) => ({ ...c, bg: v }) },
  { key: 'fill', label: 'Fill', tab: 'style', type: 'color', noRandom: true,
    get: (c, i = 0) => inst(c, i)?.fill, set: (c, v, i = 0) => patchInst(c, { fill: v }, i) },
  { key: 'font', label: 'Font', tab: 'style', type: 'select', options: FONT_OPTIONS, noRandom: true,
    get: (c, i = 0) => inst(c, i)?.font,
    set: (c, v, i = 0) => patchInst(c, { font: v, vf: normalizeVf(v, inst(c, i)?.vf) }, i) },
  { key: 'italic', label: 'Italic', tab: 'style', type: 'select', noRandom: true,
    options: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }],
    get: (c, i = 0) => (inst(c, i)?.italic ? 'on' : 'off'), set: (c, v, i = 0) => patchInst(c, { italic: v === 'on' }, i) },
  { key: 'case', label: 'Case', tab: 'style', type: 'select', noRandom: true, options: [
      { value: 'none',  label: 'Aa' },
      { value: 'upper', label: 'AA' },
      { value: 'lower', label: 'aa' },
      { value: 'title', label: 'Tt' },
    ],
    get: (c, i = 0) => inst(c, i)?.case ?? 'none', set: (c, v, i = 0) => patchInst(c, { case: v }, i) },
  { key: 'fontSize', label: 'Font size', tab: 'style', type: 'range', min: 8, max: 220, step: 1, rMin: 36, rMax: 150,
    get: (c, i = 0) => inst(c, i)?.fontSize ?? 26, set: (c, v, i = 0) => patchInst(c, { fontSize: Math.round(v) }, i) },
  { key: 'letterSpacing', label: 'Letter spacing', tab: 'style', type: 'range', min: -10, max: 40, step: 0.5, rMin: 0, rMax: 12,
    get: (c, i = 0) => inst(c, i)?.letterSpacing ?? 0, set: (c, v, i = 0) => patchInst(c, { letterSpacing: v }, i) },
  { key: 'align', label: 'Align', tab: 'style', type: 'select', noRandom: true, when: onPath, options: [
      { value: 'start',  label: 'Start' },
      { value: 'center', label: 'Center' },
      { value: 'end',    label: 'End' },
    ],
    get: (c, i = 0) => inst(c, i)?.align ?? 'center', set: (c, v, i = 0) => patchInst(c, { align: v }, i) },
  { key: 'multiply', label: 'Copies', tab: 'style', type: 'range', min: 1, max: 6, step: 1, noRandom: true, when: onPath,
    get: (c, i = 0) => inst(c, i)?.multiply ?? 1, set: (c, v, i = 0) => patchInst(c, { multiply: Math.round(v) }, i) },

  // ── Style · arrangement (type + when-gated per-type params) ──
  { key: 'arrangement', label: 'Arrangement', tab: 'style', section: 'Arrangement', type: 'select', noRandom: true,
    options: ARRANGEMENT_OPTIONS,
    get: ptype, set: (c, v, i = 0) => patchPath(c, { type: v }, i) },
  { key: 'spokes', label: 'Spokes', tab: 'style', section: 'Arrangement', type: 'range', min: 2, max: 32, step: 1, rMin: 6, rMax: 28,
    when: (c, i = 0) => ptype(c, i) === 'radial',
    get: (c, i = 0) => inst(c, i)?.path?.count ?? 12, set: (c, v, i = 0) => patchPath(c, { count: Math.round(v) }, i) },
  { key: 'rings', label: 'Rings', tab: 'style', section: 'Arrangement', type: 'range', min: 2, max: 24, step: 1, rMin: 4, rMax: 16,
    when: (c, i = 0) => ptype(c, i) === 'rings',
    get: (c, i = 0) => inst(c, i)?.path?.count ?? 12, set: (c, v, i = 0) => patchPath(c, { count: Math.round(v) }, i) },
  { key: 'inner', label: 'Inner radius', tab: 'style', section: 'Arrangement', type: 'range', min: 0, max: 0.9, step: 0.01, rMin: 0.04, rMax: 0.4,
    when: (c, i = 0) => ptype(c, i) === 'radial' || ptype(c, i) === 'rings',
    get: (c, i = 0) => inst(c, i)?.path?.inner ?? 0.12, set: (c, v, i = 0) => patchPath(c, { inner: v }, i) },
  { key: 'ringRadius', label: 'Radius', tab: 'style', section: 'Arrangement', type: 'range', min: 0.1, max: 1, step: 0.01, rMin: 0.6, rMax: 1,
    when: (c, i = 0) => ptype(c, i) === 'rings',
    get: (c, i = 0) => inst(c, i)?.path?.radius ?? 0.92, set: (c, v, i = 0) => patchPath(c, { radius: v }, i) },
  { key: 'twist', label: 'Twist', tab: 'style', section: 'Arrangement', type: 'range', min: 0, max: 2, step: 0.05, rMin: 0, rMax: 1.5,
    when: (c, i = 0) => ptype(c, i) === 'rings',
    get: (c, i = 0) => inst(c, i)?.path?.twist ?? 0.5, set: (c, v, i = 0) => patchPath(c, { twist: v }, i) },
  { key: 'grow', label: 'Grow', tab: 'style', section: 'Arrangement', type: 'range', min: 0, max: 2, step: 0.05, rMin: 0, rMax: 1.5,
    when: (c, i = 0) => ptype(c, i) === 'rings',
    get: (c, i = 0) => inst(c, i)?.path?.grow ?? 0.6, set: (c, v, i = 0) => patchPath(c, { grow: v }, i) },
  { key: 'pathRadius', label: 'Radius', tab: 'style', section: 'Arrangement', type: 'range', min: 0.2, max: 1, step: 0.01, rMin: 0.5, rMax: 1,
    when: (c, i = 0) => ['circle', 'ellipse', 'spiral'].includes(ptype(c, i)),
    get: (c, i = 0) => inst(c, i)?.path?.radius ?? 0.72, set: (c, v, i = 0) => patchPath(c, { radius: v }, i) },
  { key: 'turns', label: 'Turns', tab: 'style', section: 'Arrangement', type: 'range', min: 1, max: 6, step: 1, rMin: 2, rMax: 5,
    when: (c, i = 0) => ptype(c, i) === 'spiral',
    get: (c, i = 0) => inst(c, i)?.path?.turns ?? 3, set: (c, v, i = 0) => patchPath(c, { turns: Math.round(v) }, i) },
  { key: 'amp', label: 'Amplitude', tab: 'style', section: 'Arrangement', type: 'range', min: 0, max: 1, step: 0.05, rMin: 0.2, rMax: 0.7,
    when: (c, i = 0) => ['arc', 'sine', 'zigzag'].includes(ptype(c, i)),
    get: (c, i = 0) => inst(c, i)?.path?.amp ?? 0.4, set: (c, v, i = 0) => patchPath(c, { amp: v }, i) },
  { key: 'freq', label: 'Frequency', tab: 'style', section: 'Arrangement', type: 'range', min: 1, max: 6, step: 1, rMin: 1, rMax: 4,
    when: (c, i = 0) => ['sine', 'zigzag'].includes(ptype(c, i)),
    get: (c, i = 0) => inst(c, i)?.path?.freq ?? 2, set: (c, v, i = 0) => patchPath(c, { freq: Math.round(v) }, i) },
  { key: 'rows', label: 'Rows', tab: 'style', section: 'Arrangement', type: 'range', min: 1, max: 6, step: 1, rMin: 2, rMax: 4,
    when: (c, i = 0) => ptype(c, i) === 'array',
    get: (c, i = 0) => inst(c, i)?.path?.rows ?? 2, set: (c, v, i = 0) => patchPath(c, { rows: Math.round(v) }, i) },
  { key: 'cols', label: 'Columns', tab: 'style', section: 'Arrangement', type: 'range', min: 1, max: 8, step: 1, rMin: 2, rMax: 6,
    when: (c, i = 0) => ptype(c, i) === 'array',
    get: (c, i = 0) => inst(c, i)?.path?.cols ?? 3, set: (c, v, i = 0) => patchPath(c, { cols: Math.round(v) }, i) },

  // ── Style · Morph (glyph-outline interpolation — the "morph monster").
  // Gates follow the labs MorphPanel exactly: the whole section needs a
  // non-radial/rings arrangement; Cut B (face or vf2 axes) shows for the
  // morph/fade modes; Curve for morph only; the blend slider is labelled
  // Seed in random mode. The on-switch and face pick are noRandom
  // (structural / font-shaped choices). ──
  { key: 'morphOn', label: 'Morph outlines', tab: 'style', section: 'Morph', type: 'select', noRandom: true,
    when: canMorph, options: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }],
    get: (c, i = 0) => (morph(c, i).on ? 'on' : 'off'), set: (c, v, i = 0) => patchMorph(c, { on: v === 'on' }, i) },
  { key: 'morphMode', label: 'Mode', tab: 'style', section: 'Morph', type: 'select',
    when: morphOn, options: MORPH_MODE_OPTIONS,
    get: morphMode, set: (c, v, i = 0) => patchMorph(c, { mode: v }, i) },
  { key: 'morphFace2', label: 'Cut B face', tab: 'style', section: 'Morph', type: 'select', noRandom: true,
    when: cutB, options: (c, i = 0) => [{ value: '', label: 'Off' }, ...FONT_OPTIONS.filter((o) => o.value !== inst(c, i)?.font)],
    get: (c, i = 0) => morph(c, i).face2 ?? '', set: (c, v, i = 0) => patchMorph(c, { face2: v }, i) },
  { key: 'morphVf2Wdth', label: 'Cut B · Width', tab: 'style', section: 'Morph', type: 'range', min: 64, max: 172, step: 1,
    when: (c, i = 0) => cutB(c, i) && !morph(c, i).face2 && !!axisOf(c, 'wdth', i),
    get: (c, i = 0) => morph(c, i).vf2?.wdth ?? axisOf(c, 'wdth', i)?.max ?? 172,
    set: (c, v, i = 0) => setMorphAxis(c, 'wdth', v, i) },
  { key: 'morphVf2Wght', label: 'Cut B · Weight', tab: 'style', section: 'Morph', type: 'range', min: 100, max: 900, step: 1,
    when: (c, i = 0) => cutB(c, i) && !morph(c, i).face2 && !!axisOf(c, 'wght', i),
    get: (c, i = 0) => morph(c, i).vf2?.wght ?? axisOf(c, 'wght', i)?.max ?? 900,
    set: (c, v, i = 0) => setMorphAxis(c, 'wght', v, i) },
  { key: 'morphCurve', label: 'Curve', tab: 'style', section: 'Morph', type: 'select',
    when: (c, i = 0) => morphOn(c, i) && morphMode(c, i) === 'morph', options: CURVE_OPTIONS,
    get: (c, i = 0) => morph(c, i).curve ?? 'flat', set: (c, v, i = 0) => patchMorph(c, { curve: v }, i) },
  { key: 'morphBlend', label: 'Blend', tab: 'style', section: 'Morph', type: 'range', min: 0, max: 1, step: 0.01,
    when: (c, i = 0) => morphOn(c, i) && morphMode(c, i) !== 'random',
    get: (c, i = 0) => morph(c, i).blend ?? 0.5, set: (c, v, i = 0) => patchMorph(c, { blend: v }, i) },
  { key: 'morphSeed', label: 'Seed', tab: 'style', section: 'Morph', type: 'range', min: 0, max: 1, step: 0.01,
    when: (c, i = 0) => morphOn(c, i) && morphMode(c, i) === 'random',
    get: (c, i = 0) => morph(c, i).blend ?? 0.5, set: (c, v, i = 0) => patchMorph(c, { blend: v }, i) },

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
    get: mode, set: (c, v, i = 0) => patchMotion(c, { mode: v }, i) },
  { key: 'cycles', label: 'Cycles', tab: 'anim', type: 'range', min: 1, max: 4, step: 1, rMin: 1, rMax: 3,
    when: (c, i = 0) => mode(c, i) !== 'none',
    get: (c, i = 0) => inst(c, i)?.motion?.cycles ?? 1, set: (c, v, i = 0) => patchMotion(c, { cycles: Math.round(v) }, i) },
  { key: 'motionAmp', label: 'Amount', tab: 'anim', type: 'range', min: 0.05, max: 1, step: 0.05, rMin: 0.15, rMax: 0.6,
    when: (c, i = 0) => ['glyphwave', 'sweep', 'sweepWeight', 'sweepShift'].includes(mode(c, i)),
    get: (c, i = 0) => inst(c, i)?.motion?.amp ?? 0.3, set: (c, v, i = 0) => patchMotion(c, { amp: v }, i) },
  { key: 'motionPhase', label: 'Glyph phase', tab: 'anim', type: 'range', min: 0, max: 1.5, step: 0.05, rMin: 0.3, rMax: 1,
    when: (c, i = 0) => ['vfwave', 'glyphwave', 'cascade'].includes(mode(c, i)),
    get: (c, i = 0) => inst(c, i)?.motion?.phase ?? 0.5, set: (c, v, i = 0) => patchMotion(c, { phase: v }, i) },
  { key: 'axis', label: 'Axis', tab: 'anim', type: 'select',
    when: (c, i = 0) => ['vfwave', 'sweepWeight'].includes(mode(c, i)) && fontByKey(inst(c, i)?.font).axes.length > 1,
    options: (c, i = 0) => fontByKey(inst(c, i)?.font).axes.map((a) => ({
      value: a.tag, label: a.tag === 'wght' ? 'Weight' : a.tag === 'wdth' ? 'Width' : a.tag })),
    get: (c, i = 0) => inst(c, i)?.motion?.axis ?? 'wght', set: (c, v, i = 0) => patchMotion(c, { axis: v }, i) },
  { key: 'field', label: 'Field', tab: 'anim', type: 'select',
    when: (c, i = 0) => ['sweep', 'sweepWeight', 'sweepShift'].includes(mode(c, i)), options: [
      { value: 'x', label: 'Horizontal' },
      { value: 'y', label: 'Vertical' },
      { value: 'diagonal', label: 'Diagonal' },
      { value: 'radial', label: 'Radial' },
      { value: 'angular', label: 'Angular' },
      { value: 'wave', label: 'Wave' },
    ],
    get: (c, i = 0) => inst(c, i)?.motion?.field ?? 'x', set: (c, v, i = 0) => patchMotion(c, { field: v }, i) },
  /* The r3 headline: desync the repeated strings. Writes stagger to every
   * instance (per-unit desync inside each: spokes/rings/cells/copies) AND
   * distributes per-instance phase i/N·stagger so stacked instances shift
   * against each other. Frame-level — ignores the selected index. */
  { key: 'stagger', label: 'Stagger', tab: 'anim', type: 'range', min: 0, max: 1, step: 0.01,
    get: (c) => inst(c)?.stagger ?? 0,
    set: (c, v) => patchAll(c, (x, i, n) => ({ stagger: v, phase: n > 1 ? (i / n) * v : 0 })) },
  { key: 'spin', label: 'Spin', tab: 'anim', type: 'range', min: 0, max: 4, step: 1, rMin: 0, rMax: 3,
    when: (c, i = 0) => ptype(c, i) === 'radial' || ptype(c, i) === 'rings',
    get: (c, i = 0) => inst(c, i)?.path?.spin ?? 1, set: (c, v, i = 0) => patchPath(c, { spin: Math.round(v) }, i) },
]

// options may be static or a fn of the comp + selected index (e.g. the font's axes).
export const knobOptions = (k, comp, i = 0) => (typeof k.options === 'function' ? k.options(comp, i) : k.options ?? [])

// Roll every randomisable knob currently in play for instance `i` (when-gates
// evaluated against the progressively patched comp) — the LoopFields
// randomise idiom, comp-native.
export function randomiseComp(comp, i = 0) {
  let next = comp
  for (const k of KINETIC_KNOBS) {
    if (k.noRandom || k.type === 'color') continue
    if (k.when && !k.when(next, i)) continue
    if (k.type === 'range') {
      const lo = k.rMin ?? k.min
      const hi = k.rMax ?? k.max
      const step = k.step ?? 1
      const raw = lo + Math.random() * (hi - lo)
      next = k.set(next, Math.min(hi, Math.max(lo, Number((Math.round(raw / step) * step).toFixed(4)))), i)
    } else if (k.type === 'select') {
      const opts = knobOptions(k, next, i)
      if (opts.length) next = k.set(next, opts[Math.floor(Math.random() * opts.length)].value, i)
    }
  }
  return next
}
