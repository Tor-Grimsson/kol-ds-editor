/**
 * Dither — reaction-diffusion image dither (the labs Abstract · Dither /
 * TexTuring trick): Gray-Scott with per-cell feed/kill driven by the photo's
 * brightness, so light vs dark regions grow DIFFERENT textures and the image
 * emerges through the reaction pattern. Reuses the already-imported RDEngine
 * + DITHER_STYLES / buildFK from src/loops/abstract.
 *
 * FREE-RUNNING and non-scrubbing by design (same as the abstract loops): the
 * sim advances one step per transport tick while playing and holds while
 * paused — seeking the timeline doesn't rewind the reaction. Sim state lives
 * module-side keyed by layer id, capped LRU so deleted layers don't leak
 * Float32Arrays. Texture/contrast/invert edits re-map the feed/kill field
 * live (the running sim morphs into it); a new source image reseeds + warms
 * to a developed still.
 */
import RDEngine from '../loops/abstract/RDEngine.js'
import { DITHER_STYLES, ditherStyleById, buildFK, RD_PALETTES } from '../loops/abstract/models.js'

const N = 180

/* Per-layer sim pool — the makePool pattern from loops/abstract/presets.js.
 * Keyed by layer id; oldest evicted past the cap. */
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
const ditherPool = makePool()

/* Throwaway 2×2 render target — RDEngine insists on owning a canvas, but we
 * blit into the layer ctx ourselves via _blit. */
const tinyCanvas = () => {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 2
  return c
}

/* Sample the fitted source to an N×N luma map [0,1] (squished to square —
 * the sim grid is toroidal/square), with a contrast remap around mid-grey. */
let lumaBuf = null
function sampleBrightness(src, contrast) {
  if (!lumaBuf) { lumaBuf = document.createElement('canvas'); lumaBuf.width = N; lumaBuf.height = N }
  const g = lumaBuf.getContext('2d', { willReadFrequently: true })
  g.drawImage(src, 0, 0, N, N)
  const data = g.getImageData(0, 0, N, N).data
  const b = new Float32Array(N * N)
  for (let i = 0; i < N * N; i++) {
    const j = i << 2
    let v = (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) / 255
    v = (v - 0.5) * contrast + 0.5
    b[i] = v < 0 ? 0 : v > 1 ? 1 : v
  }
  return b
}

const opts = (arr) => arr.map((o) => ({ value: o.value, label: o.label }))

export default {
  id: 'dither',
  label: 'Dither',
  animated: true,
  params: [
    { key: 'style', label: 'Texture', type: 'select', default: 'coral', options: opts(DITHER_STYLES) },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.4 },
    { key: 'invert', label: 'Invert', type: 'toggle', default: false },
    { key: 'palette', label: 'Palette', type: 'select', default: 'ink', options: opts(RD_PALETTES) },
    { key: 'speed', label: 'Speed', type: 'range', min: 0.2, max: 3, step: 0.1, default: 1 },
  ],
  apply(ctx, src, w, h, p, u) {
    const s = ditherPool(p.id, () => {
      const engine = new RDEngine(tinyCanvas(), N)
      engine.setVariation({ model: 'gray-scott', params: { feed: 0.0545, kill: 0.062 }, palette: p.palette ?? 'ink', seed: 'scatter' })
      return { engine, cfg: { src: null, style: null, contrast: null, invert: null, palette: engine.palette }, lastU: null }
    })
    const { engine, cfg } = s

    /* Source canvas identity changes when the image/fit/size changes (the
     * host builds a fresh fitted canvas) → full re-grow: new field, reseed,
     * warm to a developed still. Style/contrast/invert just re-map the field
     * and the running sim morphs into it — no reseed. */
    const fieldStale = cfg.style !== p.style || cfg.contrast !== p.contrast || cfg.invert !== !!p.invert
    if (cfg.src !== src || fieldStale) {
      const fk = buildFK(sampleBrightness(src, p.contrast ?? 1.4), ditherStyleById(p.style), !!p.invert)
      engine.setImageField(fk.feed, fk.kill)
      if (cfg.src !== src) { engine.reseed(); engine.warmup(120) }
      cfg.src = src
      cfg.style = p.style
      cfg.contrast = p.contrast
      cfg.invert = !!p.invert
    }
    if (p.palette && cfg.palette !== p.palette) { engine.setPalette(p.palette); cfg.palette = p.palette }
    engine.setSpeed(p.speed ?? 1)
    /* u only advances while the transport plays — step exactly then, so the
     * sim pauses with the clock without importing editor code here. */
    if (u !== s.lastU) { engine.step(); s.lastU = u }
    engine.render()
    engine._blit(ctx, w, h)
  },
}
