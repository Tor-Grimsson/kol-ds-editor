/**
 * resolve — turn a prop VALUE into a concrete value for the current frame.
 *
 * A value is a tagged union (param-graph RFC Q2, inline-on-layer):
 *   <raw>                                     constant. The default and the
 *                                             entire current editor — so
 *                                             resolveValue is identity until
 *                                             a binding is added (free
 *                                             back-compat, zero overhead).
 *   { bind:'track', keys:[{t,v,easing}] }     keyframes over normalized time
 *   { bind:'mod',   source, transform }       live input → mapped value
 *
 * `ctx` = { t, mouse:{x,y} } is supplied by the transport each frame (see
 * params/transport). Sources resolve through the modulation-source registry
 * (params/sources). Track values interpolate numerically; hex colors lerp
 * in RGB; anything else steps (holds the segment-start value).
 */
import { ease } from './easing'
import { sampleSource } from './sources'

export function isBinding(v) {
  return v != null && typeof v === 'object' && typeof v.bind === 'string'
}

/* Does a layer carry ANY binding? Lets the renderer skip per-frame work for
 * fully-static layers (the whole editor, today). Filter-chain stages keep
 * their params NESTED (layer.filters[i].params) — scanned here so a bound
 * effect knob animates like any flat prop. */
export function hasBindings(layer) {
  for (const k in layer) if (isBinding(layer[k])) return true
  if (Array.isArray(layer.filters)) {
    for (const s of layer.filters) {
      const ps = s?.params
      if (ps) for (const k in ps) if (isBinding(ps[k])) return true
    }
  }
  return false
}

export function resolveValue(value, ctx, layer) {
  if (!isBinding(value)) return value
  if (value.bind === 'track') return resolveTrack(value.keys, ctx?.t ?? 0)
  if (value.bind === 'mod')   return resolveMod(value, ctx, layer)
  return undefined
}

/* Resolve every binding on a layer to a flat concrete-value layer. Untouched
 * (returns the same object) when the layer has no bindings. Filter-chain
 * stage params (nested) resolve too — untouched stages keep identity. */
export function resolveLayer(layer, ctx) {
  if (!hasBindings(layer)) return layer
  const out = { ...layer }
  for (const k in layer) if (isBinding(layer[k])) out[k] = resolveValue(layer[k], ctx, layer)
  if (Array.isArray(layer.filters)) {
    out.filters = layer.filters.map((s) => {
      const ps = s?.params
      if (!ps) return s
      let changed = false
      const np = { ...ps }
      for (const k in ps) {
        if (isBinding(ps[k])) { np[k] = resolveValue(ps[k], ctx, layer); changed = true }
      }
      return changed ? { ...s, params: np } : s
    })
  }
  return out
}

/* Resolve a whole layer tree (groups included) to concrete values — export
 * path: SVG/PNG snapshot the CURRENT frame of any animated prop. Identity
 * for fully-static trees. */
export function resolveLayersDeep(layers, ctx) {
  return layers.map((l) => {
    const r = resolveLayer(l, ctx)
    if (Array.isArray(l.children)) {
      const children = resolveLayersDeep(l.children, ctx)
      return children.some((c, i) => c !== l.children[i]) || r !== l
        ? { ...r, children }
        : l
    }
    return r
  })
}

function resolveTrack(keys, t) {
  if (!keys || keys.length === 0) return undefined
  if (keys.length === 1) return keys[0].v
  if (t <= keys[0].t) return keys[0].v
  const last = keys[keys.length - 1]
  if (t >= last.t) return last.v
  let i = 0
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++
  const a = keys[i], b = keys[i + 1]
  const span = b.t - a.t || 1
  const eased = ease(a.easing, (t - a.t) / span)
  return lerpValue(a.v, b.v, eased)
}

/* Interpolate two key values: numbers lerp, #rrggbb colors lerp per-channel,
 * anything else (palette refs, enums) steps at the segment start. */
const HEX6 = /^#[0-9a-f]{6}$/i
function lerpValue(a, b, k) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * k
  if (typeof a === 'string' && typeof b === 'string' && HEX6.test(a) && HEX6.test(b)) {
    const ca = parseInt(a.slice(1), 16), cb = parseInt(b.slice(1), 16)
    const ch = (sh) => Math.round(((ca >> sh) & 255) + (((cb >> sh) & 255) - ((ca >> sh) & 255)) * k)
    return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
  }
  return a
}

/* Per-binding smoothing state — EMA keyed on the binding OBJECT (bindings
 * persist in layer state until rewritten, so identity is the natural key;
 * a rewrite resets the smoother, which is correct). Live renders share this
 * module-level store; a deterministic pass (webm bake) supplies its own via
 * `ctx.smoothState` so its per-frame stepping neither inherits pre-bake live
 * state nor advances the live EMAs. */
const smoothState = new WeakMap()

/* Fresh, private EMA store for a deterministic resolve pass — spread it into
 * every ctx of that pass ({ ...transport.getCtx(), smoothState: ... }). The
 * EMA steps once per resolve CALL, so the pass must resolve exactly once per
 * frame. */
export const makeSmoothingState = () => new WeakMap()

/* Response shaping applied to every mod binding's normalized 0..1 signal, in a
 * fixed order (each op is identity at its default, so pre-existing bindings are
 * bit-unchanged): invert → smooth → curve → remap.
 *   invert  flip the signal              (default off)
 *   smooth  EMA temporal lag             (default 0 = raw; pre-existing)
 *   curve   response exponent raw^curve  (default 1 = linear)
 *   remap   spread 0..1 into transform.range = [lo, hi]  (default = param range)
 * `range` IS the lo/hi output remap (labs' lo/hi ≡ our range); no separate
 * lo/hi option to avoid a redundant second mapping. */
function resolveMod(binding, ctx, layer) {
  const tr = binding.transform
  let raw = sampleSource(binding.source, ctx, { transform: tr, layer })   /* 0..1 */
  if (tr?.invert) raw = 1 - raw
  /* smooth 0..1 → EMA follow factor (0 = raw, 0.95 = heavy lag). */
  const sm = tr?.smooth
  if (sm > 0) {
    const store = ctx?.smoothState ?? smoothState
    const prev = store.get(binding)
    raw = prev == null ? raw : prev + (raw - prev) * (1 - Math.min(0.95, sm))
    store.set(binding, raw)
  }
  /* curve — response exponent on the (0..1) signal; 1 is linear/identity. */
  const curve = tr?.curve
  if (curve > 0 && curve !== 1) raw = Math.pow(raw < 0 ? 0 : raw, curve)
  const range = tr?.range
  if (range) return range[0] + (range[1] - range[0]) * raw
  return raw
}

/* ── dev self-check ─────────────────────────────────────────────────── */
if (import.meta.env?.DEV) {
  console.assert(resolveValue(42, { t: 0.5 }) === 42, 'constant passthrough')
  const track = { bind: 'track', keys: [{ t: 0, v: 0, easing: 'linear' }, { t: 1, v: 100, easing: 'linear' }] }
  console.assert(resolveValue(track, { t: 0.5 }) === 50, 'track linear midpoint')
  console.assert(resolveValue(track, { t: 0 }) === 0 && resolveValue(track, { t: 1 }) === 100, 'track endpoints')
  const mod = { bind: 'mod', source: 'mouseX', transform: { range: [0, 360] } }
  console.assert(resolveValue(mod, { mouse: { x: 0.5 } }) === 180, 'mod range map')
  /* curve identity (default) vs an exponent — proves defaults are bit-unchanged. */
  const modLin = { bind: 'mod', source: 'mouseX', transform: { range: [0, 1] } }
  console.assert(resolveValue(modLin, { mouse: { x: 0.5 } }) === 0.5, 'no curve = identity')
  const modCurve = { bind: 'mod', source: 'mouseX', transform: { range: [0, 1], curve: 2 } }
  console.assert(Math.abs(resolveValue(modCurve, { mouse: { x: 0.5 } }) - 0.25) < 1e-9, 'curve exponent (0.5^2)')
  console.assert(!hasBindings({ x: 1, y: 2 }) && hasBindings({ x: track }), 'hasBindings')
  const rl = resolveLayer({ id: 'a', rotation: track }, { t: 0.5 })
  console.assert(rl.rotation === 50 && rl.id === 'a', 'resolveLayer resolves bindings, keeps rest')
  const ctrack = { bind: 'track', keys: [{ t: 0, v: '#000000', easing: 'linear' }, { t: 1, v: '#ffffff', easing: 'linear' }] }
  console.assert(resolveValue(ctrack, { t: 0.5 }) === '#808080', 'color track lerps rgb')
  const reftrack = { bind: 'track', keys: [{ t: 0, v: 'palette:primary', easing: 'linear' }, { t: 1, v: 'palette:accent', easing: 'linear' }] }
  console.assert(resolveValue(reftrack, { t: 0.5 }) === 'palette:primary', 'non-hex steps')
}
