/**
 * Abstract group — reaction-diffusion (RDEngine) + multi-scale Turing
 * patterns (MSTPEngine) as 2d loops. Both are CPU sims: FREE-RUNNING and
 * non-scrubbing by design (labs parity) — the sim advances one step per
 * transport tick while playing and holds while paused. Sim state lives
 * module-side keyed by layer id (the whole layer rides in as `p`), capped
 * LRU so deleted layers don't leak Float32Arrays.
 *
 * ponytail: sims step once per draw — playback speed follows the display
 * rate, not loopSeconds; per-loop step budgets if that ever matters.
 */
import RDEngine from './RDEngine.js'
import MSTPEngine from './MSTPEngine.js'
import { RD_VARIATIONS, RD_SEEDS, RD_PALETTES, variationById } from './models.js'
import { MSTP_PRESETS, MSTP_COLORS } from './mstp.js'

const opts = (arr) => arr.map((o) => ({ value: o.value ?? o.id, label: o.label }))

/* Per-layer sim pool. Keyed by layer id; oldest evicted past the cap. */
function makePool(cap = 6) {
  const pool = new Map()
  return (id, create) => {
    if (pool.has(id)) {
      const hit = pool.get(id)
      pool.delete(id)
      pool.set(id, hit)   /* refresh LRU order */
      return hit
    }
    const made = create()
    pool.set(id, made)
    if (pool.size > cap) {
      const oldest = pool.keys().next().value
      pool.get(oldest).engine.dispose?.()
      pool.delete(oldest)
    }
    return made
  }
}

/* Throwaway 2×2 render target — the engines insist on owning a canvas, but
 * we blit into the layer ctx ourselves via _blit. */
const tinyCanvas = () => {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 2
  return c
}

/* ── Reaction-diffusion ─────────────────────────────────────────────── */
const rdPool = makePool()

/* Model family behind the layer's variation — gates the per-model reaction
 * sliders (ranges from models.js `controls`; defaults = MODEL_DEFAULTS). */
const rdModel = (l) => (variationById(l.variation) || RD_VARIATIONS[0]).model
/* Reaction keys pushed into RDEngine.setParams each draw. NB the presets pin
 * each variation's regime values; flipping the Variation select alone keeps
 * the current slider values (labs reloaded them per pick). */
const RD_PARAM_KEYS = ['feed', 'kill', 'a', 'b', 'f', 'eps']

const rdLoop = {
  id: 'abstract-rd',
  label: 'Reaction-diffusion',
  group: 'abstract',
  kind: '2d',
  duration: 8,
  params: [
    { key: 'variation', label: 'Variation', type: 'select', default: 'coral', options: opts(RD_VARIATIONS) },
    { key: 'feed', label: 'Feed', type: 'range', min: 0.01, max: 0.1, step: 0.001, default: 0.0545, when: (l) => rdModel(l) === 'gray-scott' },
    { key: 'kill', label: 'Kill', type: 'range', min: 0.04, max: 0.08, step: 0.001, default: 0.062, when: (l) => rdModel(l) === 'gray-scott' },
    { key: 'a', label: 'Feed A', type: 'range', min: 0.02, max: 0.2, step: 0.005, default: 0.1, when: (l) => rdModel(l) === 'schnakenberg' },
    { key: 'b', label: 'Feed B', type: 'range', min: 0.4, max: 1.6, step: 0.02, default: 0.9, when: (l) => rdModel(l) === 'schnakenberg' },
    /* oregonator has no variation yet (models.js: deferred) — these stay
     * hidden until one lands, then light up with no further schema work */
    { key: 'f', label: 'Stoichiometry', type: 'range', min: 0.6, max: 2.2, step: 0.05, default: 1.4, when: (l) => rdModel(l) === 'oregonator' },
    { key: 'eps', label: 'Epsilon', type: 'range', min: 0.01, max: 0.08, step: 0.005, default: 0.02, when: (l) => rdModel(l) === 'oregonator' },
    { key: 'palette', label: 'Palette', type: 'select', default: 'jade', options: opts(RD_PALETTES) },
    { key: 'seed', label: 'Seed', type: 'select', default: 'scatter', options: opts(RD_SEEDS) },
    { key: 'speed', label: 'Speed', type: 'range', min: 0.2, max: 3, step: 0.1, default: 1 },
  ],
  draw(ctx, u, w, h, p) {
    const s = rdPool(p.id, () => {
      const engine = new RDEngine(tinyCanvas(), 180)
      const v = variationById(p.variation) || RD_VARIATIONS[0]
      engine.setVariation(v)
      engine.warmup(70)
      return { engine, cfg: { variation: p.variation, palette: v.palette, seed: v.seed }, lastU: null }
    })
    const { engine, cfg } = s
    if (cfg.variation !== p.variation) {
      engine.setVariation(variationById(p.variation) || RD_VARIATIONS[0])
      engine.warmup(70)
      cfg.variation = p.variation
      cfg.palette = engine.palette
      cfg.seed = engine.seedStyle
    }
    if (p.palette && cfg.palette !== p.palette) { engine.setPalette(p.palette); cfg.palette = p.palette }
    if (p.seed && cfg.seed !== p.seed) { engine.setSeed(p.seed); cfg.seed = p.seed }
    engine.setSpeed(p.speed ?? 1)
    /* reaction sliders → the sim's live params (models ignore foreign keys) */
    const rp = {}
    for (const k of RD_PARAM_KEYS) if (p[k] != null) rp[k] = p[k]
    engine.setParams(rp)
    /* u only advances while the transport plays — step exactly then, so the
     * sim pauses with the clock without importing editor code here. */
    if (u !== s.lastU) { engine.step(); s.lastU = u }
    engine.render()
    engine._blit(ctx, w, h)
  },
}

const RD_LOOP_PRESETS = RD_VARIATIONS.map((v) => ({
  id: `rd-${v.id}`,
  label: v.label,
  loop: 'abstract-rd',
  sub: 'Reaction',
  /* ...v.params pins the regime (feed/kill etc.) so the exposed sliders land
   * on each variation's Pearson values, not the schema defaults */
  params: { variation: v.id, palette: v.palette ?? 'lava', seed: v.seed ?? 'scatter', speed: 1, ...v.params },
}))

/* ── Multi-scale Turing patterns ────────────────────────────────────── */
const mstpPool = makePool()

const mstpLoop = {
  id: 'abstract-mstp',
  label: 'Turing pattern',
  group: 'abstract',
  kind: '2d',
  duration: 8,
  params: [
    { key: 'scalePreset', label: 'Scales', type: 'select', default: 'classic', options: opts(MSTP_PRESETS) },
    { key: 'colors', label: 'Colors', type: 'select', default: 'candy', options: opts(MSTP_COLORS) },
    /* engine colorMode: smooth height→palette vs per-pixel winning scale
     * (labs SegmentedToggle values 'palette' | 'scale') */
    { key: 'colorMode', label: 'Colour mode', type: 'select', default: 'palette',
      options: [{ value: 'palette', label: 'Palette' }, { value: 'scale', label: 'By scale' }] },
    { key: 'relief', label: 'Relief', type: 'range', min: 0, max: 8, step: 0.25, default: 3 },
    { key: 'speed', label: 'Speed', type: 'range', min: 0.2, max: 3, step: 0.1, default: 1 },
  ],
  draw(ctx, u, w, h, p) {
    const s = mstpPool(p.id, () => {
      const engine = new MSTPEngine(240, 240)
      engine.setCanvas(tinyCanvas())
      engine.setPreset(p.scalePreset || 'classic')
      engine.setColors(p.colors || 'candy')
      engine.warmup(40)
      return { engine, cfg: { scalePreset: p.scalePreset, colors: p.colors }, lastU: null }
    })
    const { engine, cfg } = s
    if (cfg.scalePreset !== p.scalePreset) {
      engine.setPreset(p.scalePreset)
      engine.reseed()
      engine.warmup(40)
      cfg.scalePreset = p.scalePreset
    }
    if (cfg.colors !== p.colors) { engine.setColors(p.colors); cfg.colors = p.colors }
    engine.setColorMode(p.colorMode || 'palette')
    engine.setRelief(p.relief ?? 3)
    engine.setSpeed(p.speed ?? 1)
    if (u !== s.lastU) { engine.step(); s.lastU = u }
    engine.render()
    engine._blit(ctx, w, h)
  },
}

/* Every scale set × every colour set (labs mstp.js carries five: candy,
 * spectrum, gold, ocean, mono) — 4 × 5 = 20 combos. */
const MSTP_LOOP_PRESETS = MSTP_PRESETS.flatMap((sp) =>
  MSTP_COLORS.map((c) => ({
    id: `mstp-${sp.id}-${c.value}`,
    label: `${sp.label} · ${c.label}`,
    loop: 'abstract-mstp',
    sub: 'Turing',
    params: { scalePreset: sp.id, colors: c.value, relief: 3, speed: 1 },
  })),
)

export const ABSTRACT_LOOPS = [rdLoop, mstpLoop]
export const ABSTRACT_PRESETS = [...RD_LOOP_PRESETS, ...MSTP_LOOP_PRESETS]
