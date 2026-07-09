// Penrose host — turns ONE labs prototype (kol-labs-single src/pages/penrose)
// into ONE editor loop def via protoLoop(proto). The prototypes are generative
// sims that grow inside a masked SDF (glyph or vector shape): init() builds
// state synchronously (packing / dart-throwing — HEAVY), registers its
// per-frame step via wrapLoop, and the host drives that step per transport
// tick.
//
// FREE-RUNNING / NON-SCRUBBING by design (the abstract-sims / math-orbits
// idiom): the frame is integrated history, not a function of u. draw() steps
// the sim exactly when u advances — so it pauses with the transport and holds
// while paused — and scrubbing does NOT rewind. Sim state lives module-side
// keyed by a STRUCTURAL signature (proto id + mask params + seed + generation
// params + buffer size); any structural change re-runs init via collectSteps.
// Colours are NOT structural: the five role params (bg/fg/accent/dim/warm)
// sync into the live PALETTE singleton each tick and the stroke tint remaps
// authored hues on the fly, so theme flips re-tint without re-init.
//
// NOTE binding a structural param (most generation knobs) to the transport
// re-inits every frame — same caveat as math-orbits' count/seed. Bind the
// live keys (declared per proto in presets.js) or colours instead.

import { loadFonts as loadEditorFonts, FONTS as EDITOR_FONTS } from '../../kinetic/fonts.js'
import { transport } from '../../editor/params/transport.js'
import { themeById, DEFAULT_THEME } from '../lib/themes.js'
import { setPalette, syncOpacity } from './palette.js'
import { makeSDF, setLoopClock, collectSteps } from './common.js'
import { makeMapper, tintedContext } from './tint.js'
import { rasterizeGlyph, computeSDF } from './sdf.js'
import { rasterizeShape, SHAPE_SOURCES } from './shapes.js'
import { mulberry32 } from '../gl/rng.js'
import { defaultValues } from './knobs.js'

const DURATION = 8      // seconds per u-cycle (transport loop length)
const CLOCK_RATE = 0.5  // labs SquishyClock default speed — protos that read
                        // clock.nowSeconds() were tuned against half-rate time
const LOGICAL = 960     // default logical artboard res (the labs bake scale) —
                        // SDF/sim space is baked at this scale (contain-fit to
                        // the layer aspect) so every generation param behaves
                        // exactly as tuned in labs, independent of the layer's
                        // pixel size. The `resolution` param overrides it per
                        // layer (structural — re-inits the sim).

/* ── shared schema (every penrose loop gets these ahead of its own knobs) ── */

const T = themeById(DEFAULT_THEME)
const DEFAULT_FONT = 'TG Gullhamrar' // labs default face; shipped by kinetic/fonts.js
const isGlyph = (l) => (l.shape ?? 'glyph') === 'glyph'

const MASK_PARAMS = [
  { key: 'shape', label: 'Shape', type: 'select', default: 'glyph', tab: 'generate', options: SHAPE_SOURCES.map((s) => ({ value: s.id, label: s.label })) },
  { key: 'glyph', label: 'Glyph', type: 'text', rows: 1, default: 'A', tab: 'generate', when: isGlyph },
  { key: 'font', label: 'Font', type: 'select', default: DEFAULT_FONT, tab: 'generate', when: isGlyph, options: EDITOR_FONTS.map((f) => ({ value: f.family, label: f.label })) },
  { key: 'weight', label: 'Weight', type: 'select', default: '700', tab: 'generate', when: isGlyph, options: ['300', '400', '500', '700', '900'].map((w) => ({ value: w, label: w })) },
  { key: 'seed', label: 'Seed', type: 'range', min: 1, max: 99, step: 1, default: 1, tab: 'generate', noRandom: true },
  { key: 'resolution', label: 'Resolution', type: 'range', min: 480, max: 1920, step: 60, default: LOGICAL, tab: 'generate', noRandom: true },
]

/* Five-role colour params. bg/fg/accent are patched by the editor's theme
 * picker (loops/theme.js role map); dim/warm carry the same role tags for
 * forward-compat but today only change via their ColorFields — defaults come
 * from the KOL theme so presets read as a scheme out of the box. */
const COLOR_PARAMS = [
  { key: 'bg', label: 'Background', type: 'color', role: 'bg', default: T.bg },
  { key: 'fg', label: 'Foreground', type: 'color', role: 'fg', default: T.fg },
  { key: 'accent', label: 'Accent', type: 'color', role: 'accent', default: T.accent },
  { key: 'dim', label: 'Dim', type: 'color', role: 'dim', default: T.dim },
  { key: 'warm', label: 'Warm', type: 'color', role: 'warm', default: T.warm },
  /* Per-role opacity boosters (labs settings.js 0–5 model; dim boots at 5 —
   * prototypes author dim strokes at very low alpha and rely on the boost). */
  { key: 'fgOpacity', label: 'Foreground opacity', type: 'range', min: 0, max: 5, step: 0.1, default: 1 },
  { key: 'accentOpacity', label: 'Accent opacity', type: 'range', min: 0, max: 5, step: 0.1, default: 1 },
  { key: 'dimOpacity', label: 'Dim opacity', type: 'range', min: 0, max: 5, step: 0.1, default: 5 },
  { key: 'warmOpacity', label: 'Warm opacity', type: 'range', min: 0, max: 5, step: 0.1, default: 1 },
]

/* ── labs param schema → editor schema grammar ────────────────────────────
 *   int              → range (step 1)         · label kept verbatim
 *   range            → range (step ?? 0.01)
 *   boolean / bool   → toggle
 *   select           → select (raw option values wrapped to {value,label};
 *                      numeric flag when the values are numbers)
 *   color            → color (no role — authored, untinted by the theme) */
function translateParam(p) {
  const base = { key: p.key, label: p.label ?? p.key, default: p.default }
  switch (p.type) {
    case 'int': return { ...base, type: 'range', min: p.min, max: p.max, step: p.step ?? 1 }
    case 'range': return { ...base, type: 'range', min: p.min, max: p.max, step: p.step ?? 0.01 }
    case 'boolean':
    case 'bool': return { ...base, type: 'toggle' }
    case 'select': return {
      ...base, type: 'select',
      options: (p.options ?? []).map((o) => ({ value: o, label: String(o) })),
      numeric: typeof p.default === 'number',
    }
    case 'color': return { ...base, type: 'color' }
    default: return { ...base, type: 'range', min: p.min ?? 0, max: p.max ?? 1, step: p.step ?? 0.01 }
  }
}

/* ── palette sync (theme roles → the live PALETTE singleton) ──────────────
 * Runs at the top of every draw so multiple penrose layers with different
 * colour params each step against their own palette. */
const hexToRGBA = (hex, a) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
function syncPalette(p) {
  const fg = p.fg ?? T.fg
  setPalette({
    bg: p.bg ?? T.bg,
    fg,
    accent: p.accent ?? T.accent,
    dim: p.dim ?? T.dim,
    warm: p.warm ?? T.warm,
    grid: hexToRGBA(fg, 0.07),
  })
  return [p.bg ?? T.bg, fg, p.accent ?? T.accent, p.dim ?? T.dim, p.warm ?? T.warm].join('|')
}

/* ── module-side sim state, LRU-capped (buffers + packed geometry are big) ── */
const STATES = new Map()
const CAP = 4

function getState(proto, structuralKeys, w, h, p) {
  /* The transport's reset epoch is structural: stop/rewind bump it, so the
   * proto instance rebuilds (init re-runs) and the generative run starts
   * fresh — the LRU no longer lets sim state survive a stop. */
  const sig = [
    proto.id, p.shape ?? 'glyph', p.glyph ?? 'A', p.font ?? '', p.weight ?? '700',
    p.seed ?? 1, p.resolution ?? LOGICAL, w | 0, h | 0, transport.getEpoch(),
    ...structuralKeys.map((k) => `${k}:${p[k]}`),
  ].join('|')
  let s = STATES.get(sig)
  if (s) {
    STATES.delete(sig)
    STATES.set(sig, s)   /* refresh LRU order */
    return s
  }
  s = createState(proto, w, h, p)
  STATES.set(sig, s)
  while (STATES.size > CAP) {
    const oldest = STATES.keys().next().value
    const dead = STATES.get(oldest)
    dead.dead = true
    try { dead.cleanup?.() } catch { /* proto cleanup best-effort */ }
    STATES.delete(oldest)
  }
  return s
}

function createState(proto, w, h, p) {
  const bw = Math.max(1, w | 0)
  const bh = Math.max(1, h | 0)
  const buf = document.createElement('canvas')
  buf.width = bw
  buf.height = bh
  const bctx = buf.getContext('2d')

  const s = {
    buf, bctx,
    ready: false, dead: false,
    steps: [], cleanup: null, params: null,
    lastU: null, timeSec: 0,
    paletteSig: '', mapColor: (v) => v,
    clock: null,
  }
  /* Per-state clock — protos call clock.nowSeconds() (01's bounce pulse etc.);
   * the host advances timeSec from transport-u deltas, so clock time pauses,
   * speeds and holds exactly with the transport. */
  s.clock = {
    nowSeconds: () => s.timeSec,
    now: () => s.timeSec * 1000,
    isPaused: () => false,
    speed: CLOCK_RATE,
  }

  /* SDF/sim space: contain the layer aspect in a logical box (labs parity —
   * labs baked a square 960 mask; non-square layers keep the logical res on
   * the long side so radii/step params mean the same thing they did in labs).
   * The `resolution` param scales the bake: higher = finer sim detail,
   * heavier init. */
  const logical = Math.max(480, Math.min(1920, Math.round(p.resolution ?? LOGICAL)))
  const k = logical / Math.max(bw, bh)
  const mw = Math.max(8, Math.round(bw * k))
  const mh = Math.max(8, Math.round(bh * k))

  const finish = (mask) => {
    if (s.dead) return
    const sdf = makeSDF(computeSDF(mask, mw, mh), mw, mh)
    const rng = mulberry32((p.seed ?? 1) >>> 0)
    /* Mutable live param object — draw() re-assigns every proto key each tick
     * so knobs the proto reads via `params.x` inside its step act live;
     * init-destructured knobs are structural (sig change → re-init). */
    const params = defaultValues(proto.params)
    for (const key of Object.keys(params)) if (p[key] !== undefined) params[key] = p[key]
    s.params = params
    const wctx = tintedContext(bctx, (v) => s.mapColor(v))
    setLoopClock(s.clock)
    try {
      s.steps = collectSteps(() => {
        s.cleanup = proto.init({ canvas: buf, ctx: wctx, sdf, W: bw, H: bh, rng, seed: p.seed ?? 1, params, clock: s.clock }) ?? null
      })
      s.ready = true
    } catch (err) {
      console.error(`[penrose-${proto.id}] init threw:`, err)
      s.steps = []
      s.ready = true /* don't retry per frame — bg + empty buffer render */
    }
  }

  const shape = p.shape ?? 'glyph'
  if (shape === 'glyph') {
    /* Async: FontFace registration + document.fonts.load, then bake. Until it
     * resolves, draw() paints bg only; no re-kick per frame (state persists). */
    loadEditorFonts()
    rasterizeGlyph(String(p.glyph ?? 'A') || 'A', p.font ?? DEFAULT_FONT, String(p.weight ?? '700'), Math.min(mw, mh) * 0.9, mw, mh)
      .then(finish)
      .catch((err) => console.error(`[penrose-${proto.id}] glyph bake failed:`, err))
  } else {
    finish(rasterizeShape(shape, mw, mh))
  }
  return s
}

/* ── the factory ──────────────────────────────────────────────────────────
 * protoLoop(proto, opts) → editor loop def.
 *   opts.live — proto param keys the sim reads per-step via `params.x`
 *   (excluded from the structural signature → edits act live, bindable). */
export function protoLoop(proto, opts = {}) {
  const live = new Set(opts.live ?? [])
  const structuralKeys = (proto.params ?? []).map((q) => q.key).filter((key) => !live.has(key))
  const protoParamKeys = (proto.params ?? []).map((q) => q.key)
  return {
    id: `penrose-${proto.id}`,
    label: proto.name,
    group: 'penrose',
    kind: '2d',
    duration: DURATION,
    params: [...MASK_PARAMS, ...COLOR_PARAMS, ...(proto.params ?? []).map(translateParam)],
    // u only gates stepping (pauses with the transport) — see header.
    draw(ctx, u, w, h, p) {
      const paletteSig = syncPalette(p)
      syncOpacity(p)
      const s = getState(proto, structuralKeys, w, h, p)
      if (s.paletteSig !== paletteSig) {
        s.paletteSig = paletteSig
        s.mapColor = makeMapper({ bg: p.bg ?? T.bg, fg: p.fg ?? T.fg, accent: p.accent ?? T.accent, dim: p.dim ?? T.dim, warm: p.warm ?? T.warm })
      }
      if (s.ready && u !== s.lastU) {
        if (s.lastU != null) {
          let du = u - s.lastU
          if (du < 0) du += 1                 /* loop wrap */
          s.timeSec += du * DURATION * CLOCK_RATE
        }
        s.lastU = u
        for (const key of protoParamKeys) if (p[key] !== undefined) s.params[key] = p[key]
        for (const step of s.steps) step()
      }
      /* Blit over an opaque bg fill — labs showed the stage bg through the
       * transparent engine canvas; the layer's bg param plays that part.
       * (penrose ids sit in the registry's BG_MIX_IDS: trail-fade protos wash
       * translucent bg, so the toggle stays hidden and bg always paints.) */
      ctx.fillStyle = p.bg ?? T.bg
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(s.buf, 0, 0, w, h)
    },
  }
}
