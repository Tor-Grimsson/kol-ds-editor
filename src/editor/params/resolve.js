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
 * fully-static layers (the whole editor, today). */
export function hasBindings(layer) {
  for (const k in layer) if (isBinding(layer[k])) return true
  return false
}

export function resolveValue(value, ctx) {
  if (!isBinding(value)) return value
  if (value.bind === 'track') return resolveTrack(value.keys, ctx?.t ?? 0)
  if (value.bind === 'mod')   return resolveMod(value, ctx)
  return undefined
}

/* Resolve every binding on a layer to a flat concrete-value layer. Untouched
 * (returns the same object) when the layer has no bindings. */
export function resolveLayer(layer, ctx) {
  if (!hasBindings(layer)) return layer
  const out = { ...layer }
  for (const k in layer) if (isBinding(layer[k])) out[k] = resolveValue(layer[k], ctx)
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

function resolveMod(binding, ctx) {
  const raw = sampleSource(binding.source, ctx)          /* 0..1 */
  const range = binding.transform?.range
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
  console.assert(!hasBindings({ x: 1, y: 2 }) && hasBindings({ x: track }), 'hasBindings')
  const rl = resolveLayer({ id: 'a', rotation: track }, { t: 0.5 })
  console.assert(rl.rotation === 50 && rl.id === 'a', 'resolveLayer resolves bindings, keeps rest')
  const ctrack = { bind: 'track', keys: [{ t: 0, v: '#000000', easing: 'linear' }, { t: 1, v: '#ffffff', easing: 'linear' }] }
  console.assert(resolveValue(ctrack, { t: 0.5 }) === '#808080', 'color track lerps rgb')
  const reftrack = { bind: 'track', keys: [{ t: 0, v: 'palette:primary', easing: 'linear' }, { t: 1, v: 'palette:accent', easing: 'linear' }] }
  console.assert(resolveValue(reftrack, { t: 0.5 }) === 'palette:primary', 'non-hex steps')
}
