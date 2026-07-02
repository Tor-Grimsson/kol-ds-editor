/**
 * Scanline — the cumulative-sum scanline engine driven by the photo's luma
 * instead of a procedural field (the labs scanlines FILTER mode). Marks bunch
 * where the image is bright and spread where it's dark, so the photo reads
 * through the mark density.
 *
 * Reuses the ported generative engine (src/loops/scanline/engine.js) via its
 * `p.sample` luma hook. The labs FILTER_PRESETS surface as a 'look' select —
 * each look applies its full curated param set (geometry/mark/rows/gaps/…)
 * at render time; only the source-agnostic knobs (colors, mark size, invert,
 * pulse/sweep motion) are exposed as live params. The 5th labs preset
 * (Mirror) was webcam-only with Photo's numbers — dropped.
 *
 * Animation: pulse breathes the density field, sweep travels a per-mark size
 * wave — both woven in the engine from integer cycles of u ⇒ seamless.
 */
import { renderScanlines } from '../loops/scanline/engine.js'

/* The labs FILTER_PRESETS param sets, keyed by look id (source key dropped —
 * the photo layer IS the source here). */
const LOOKS = {
  photo: { geometry: 'rows', mark: 'dots', rows: 120, minGap: 3, maxGap: 22, contrast: 1.2, displace: 0 },
  lines: { geometry: 'rows', mark: 'dash', rows: 110, minGap: 3, maxGap: 20, dashLen: 1, contrast: 1 },
  mesh: { geometry: 'rows', mark: 'lattice', rows: 80, minGap: 5, maxGap: 16, displace: 0.45, contrast: 1 },
  ascii: { geometry: 'rows', mark: 'glyph', rows: 64, minGap: 7, maxGap: 18, charset: 'ascii', contrast: 1.3 },
}

/* Downscaled luma sampler, cached by source-canvas identity — the host hands
 * us a NEW fitted canvas whenever the image / fit / size changes, so the
 * getImageData + buffer build runs once per source, not per frame. The engine
 * only needs a coarse density field; 160px across is plenty. */
const LUMA_W = 160
const lumaCache = new WeakMap()
function lumaSampler(src) {
  let s = lumaCache.get(src)
  if (!s) {
    const sw = LUMA_W
    const sh = Math.max(1, Math.round(LUMA_W * (src.height / Math.max(1, src.width))))
    const c = document.createElement('canvas')
    c.width = sw
    c.height = sh
    const g = c.getContext('2d')
    g.drawImage(src, 0, 0, sw, sh)
    const { data } = g.getImageData(0, 0, sw, sh)
    s = (nx, ny) => {
      const x = Math.min(sw - 1, Math.max(0, (nx * sw) | 0))
      const y = Math.min(sh - 1, Math.max(0, (ny * sh) | 0))
      const i = (y * sw + x) << 2
      return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    }
    lumaCache.set(src, s)
  }
  return s
}

export default {
  id: 'scanline',
  label: 'Scanline',
  animated: true,
  params: [
    { key: 'look', label: 'Look', type: 'select', default: 'photo',
      options: [
        { value: 'photo', label: 'Photo' },
        { value: 'lines', label: 'Lines' },
        { value: 'mesh', label: 'Mesh' },
        { value: 'ascii', label: 'Ascii' },
      ] },
    { key: 'bg', label: 'Background', type: 'color', default: '#06070b' },
    { key: 'fg', label: 'Ink', type: 'color', default: '#f4f1ea' },
    /* glyph marks size via the look's fixed fontScale/rows, not markSize */
    { key: 'markSize', label: 'Mark size', type: 'range', min: 0.2, max: 3, step: 0.05, default: 1, when: (l) => l.look !== 'ascii' },
    { key: 'invert', label: 'Invert', type: 'toggle', default: false },
    { key: 'pulse', label: 'Pulse', type: 'range', min: 0, max: 1, step: 0.05, default: 0 },
    /* the engine's sweep wave skips the lattice mark (mesh look) */
    { key: 'sweep', label: 'Sweep', type: 'range', min: 0, max: 1, step: 0.05, default: 0, when: (l) => l.look !== 'mesh' },
  ],
  apply(ctx, src, w, h, p, u) {
    const look = LOOKS[p.look] || LOOKS.photo
    renderScanlines(ctx, u, w, h, {
      ...look,
      bg: p.bg ?? '#06070b',
      fg: p.fg ?? '#f4f1ea',
      markSize: p.markSize ?? 1,
      invert: !!p.invert,
      pulse: p.pulse ?? 0,
      sweep: p.sweep ?? 0,
      /* flow=1 keeps the engine's phase ph = TAU·u alive so pulse/sweep
       * animate; the procedural field it would scroll is overridden by
       * `sample`, so nothing else moves. */
      flow: 1,
      spin: 0,
      seed: 0,
      sample: lumaSampler(src),
    })
  },
}
