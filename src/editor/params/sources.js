/**
 * Modulation sources — the input nodes feeding the param graph (plan.md
 * Phase 2, expanded in Phase 9). A source turns live input into a normalized
 * 0..1 signal the resolver maps onto a param's range.
 *
 * Registry entries:
 *   id      unique key referenced by { bind:'mod', source: id } bindings
 *   label   display name (bind menu)
 *   sample(ctx, opts) -> 0..1
 *           ctx  = transport's { t, mouse, stage } (stage = pointer in
 *                  virtual-canvas px, fed by CanvasArea)
 *           opts = { transform, layer } — the binding's transform (LFO
 *                  rate/phase, MIDI cc) and the owning layer (layer-local
 *                  pointer)
 *   live    true if the source changes outside transport time / mouse events
 *           (audio, MIDI, gamepad) — transport notifies per frame while one
 *           is active
 *   ensure? async setup on first bind (mic permission, MIDI access) — called
 *           from the bind UI (a user gesture, so permission prompts fly)
 *   active? () => bool      live source currently producing a signal
 */
import { readAudio, isAudioEnabled, enableAudio } from './audioBands'
import { enableMidi, isMidiEnabled, readCC, anyCCSeen } from './midi'
import { compileExpr } from './expr'
/* Import cycle with ./transport (it imports anyLiveSourceActive) — safe:
 * both sides only dereference the other inside functions, never at module
 * evaluation time. */
import { transport } from './transport'

const SOURCES = new Map()

export function registerSource(src) {
  if (!src?.id) throw new Error('modulation source needs an id')
  SOURCES.set(src.id, src)
  return src
}
export function getSource(id)  { return SOURCES.get(id) }
export function getSources()   { return [...SOURCES.values()] }

export function sampleSource(id, ctx, opts) {
  const s = SOURCES.get(id)
  if (!s) return 0
  const v = s.sample(ctx, opts)
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
}

/* Any live source active? Transport polls this to keep notifying while
 * paused (live modulation must track input without play). */
export function anyLiveSourceActive() {
  for (const s of SOURCES.values()) if (s.live && s.active?.()) return true
  return false
}

/* ── time + pointer ─────────────────────────────────────────────────── */

registerSource({ id: 'time',   label: 'Time',    sample: (ctx) => ctx?.t ?? 0 })
registerSource({ id: 'mouseX', label: 'Mouse X', sample: (ctx) => ctx?.mouse?.x ?? 0 })
registerSource({ id: 'mouseY', label: 'Mouse Y', sample: (ctx) => ctx?.mouse?.y ?? 0 })

/* Pointer within the LAYER's own bounds (0..1, clamped) — reads the stage
 * pointer (virtual px) the canvas feeds the transport. 0.5 until the
 * pointer has entered the stage. */
const layerLocal = (axis) => (ctx, opts) => {
  const st = ctx?.stage
  const l = opts?.layer
  if (!st || !l || l.w == null || l.h == null) return 0.5
  return axis === 'x' ? (st.x - l.x) / Math.max(1, l.w) : (st.y - l.y) / Math.max(1, l.h)
}
registerSource({ id: 'layerX', label: 'Pointer over layer X', sample: layerLocal('x') })
registerSource({ id: 'layerY', label: 'Pointer over layer Y', sample: layerLocal('y') })

/* ── LFOs — pure functions of loop time (scrub-safe; integer rates are
 *    seamless). rate = cycles per loop, phase = 0..1 offset, both from the
 *    binding's transform. ────────────────────────────────────────────── */

const lfoPhase = (ctx, opts) => {
  const rate = opts?.transform?.rate ?? 1
  const phase = opts?.transform?.phase ?? 0
  return ((ctx?.t ?? 0) * rate + phase) % 1
}
registerSource({ id: 'lfo-sine',     label: 'LFO · sine',     sample: (c, o) => 0.5 - 0.5 * Math.cos(lfoPhase(c, o) * Math.PI * 2) })
registerSource({ id: 'lfo-triangle', label: 'LFO · triangle', sample: (c, o) => { const p = lfoPhase(c, o); return p < 0.5 ? p * 2 : 2 - p * 2 } })
registerSource({ id: 'lfo-square',   label: 'LFO · square',   sample: (c, o) => (lfoPhase(c, o) < 0.5 ? 1 : 0) })

/* ── expression — labs' exprParam grammar over loop time (see ./expr for
 *    the t/max semantics). transform.expr holds the string; oscillators are
 *    0..1 so the output rides the same clamp + range mapping as every other
 *    source. `active` matters only while an audio/rand expression is
 *    actually bound: each live sample re-warms a decaying flag, so the
 *    paused-notify loop stays alive exactly as long as one is in use and
 *    winds down ~0.5s after the last live binding goes away. ──────────── */

let exprLiveUntil = 0
registerSource({
  id: 'expr',
  label: 'Expression',
  live: true,
  active: () => performance.now() < exprLiveUntil,
  sample: (ctx, opts) => {
    const c = compileExpr(opts?.transform?.expr ?? 'wave(t)')
    if (c.usesLive) exprLiveUntil = performance.now() + 500
    /* ctx.t is normalized loop time; expressions speak SECONDS (labs). */
    return c.fn((ctx?.t ?? 0) * transport.getLoopSeconds())
  },
})

/* ── audio — FFT bands from the shared analyser (mic or file; enable rides
 *    the bind gesture, or the transport footer's audio row). ──────────── */

const band = (key) => ({
  id: `audio-${key}`,
  label: `Audio · ${key}`,
  live: true,
  active: isAudioEnabled,
  ensure: () => enableAudio(),
  sample: () => readAudio()[key],
})
registerSource(band('level'))
registerSource(band('bass'))
registerSource(band('mid'))
registerSource(band('high'))
/* Back-compat: pre-Phase-9 bindings stored source 'audio' (the old RMS
 * source) — alias to level, hidden from the bind menu. */
registerSource({ ...band('level'), id: 'audio', hidden: true })

/* ── MIDI — last-seen CC value; the binding's transform.cc picks the knob
 *    (MIDI learn in the bind editor). ──────────────────────────────────── */

registerSource({
  id: 'midi',
  label: 'MIDI CC',
  live: true,
  active: () => isMidiEnabled() && anyCCSeen(),
  ensure: () => enableMidi(),
  sample: (ctx, opts) => {
    const cc = opts?.transform?.cc
    return cc == null ? 0 : readCC(cc)
  },
})

/* ── gamepad — first pad's left stick, -1..1 → 0..1 (poll-only API). ──── */

const padAxis = (n) => {
  const pad = typeof navigator !== 'undefined' && navigator.getGamepads?.()[0]
  return pad ? (pad.axes[n] + 1) / 2 : 0
}
const padActive = () => typeof navigator !== 'undefined' && !!navigator.getGamepads?.()[0]
registerSource({ id: 'padX', label: 'Joystick X', live: true, active: padActive, sample: () => padAxis(0) })
registerSource({ id: 'padY', label: 'Joystick Y', live: true, active: padActive, sample: () => padAxis(1) })
