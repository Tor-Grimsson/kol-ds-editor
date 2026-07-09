/**
 * Scanline — the cumulative-sum scanline engine driven by the photo's luma
 * instead of a procedural field (the labs scanlines FILTER mode). Marks bunch
 * where the image is bright and spread where it's dark, so the photo reads
 * through the mark density.
 *
 * Reuses the ported generative engine (src/loops/scanline/engine.js) via its
 * `p.sample` luma hook. Labs' scanline FILTER mode exposes the SAME live
 * Geometry / Spacing / Mark control surface as the generator over the source
 * (ScanlineEditor.jsx:468-517, `isFilter || tab==='style'`) — so this schema
 * mirrors the scanline LOOP's param set instead of locking curated "looks".
 * Field/freq/lens/seed are omitted: `p.sample` overrides the procedural field
 * entirely (see engine `fieldAt`), so they'd be dead controls — labs hides the
 * Field section in filter mode for the same reason.
 *
 * Animation: pulse breathes the density field, sweep travels a per-mark size
 * wave — both woven in the engine from integer cycles of u ⇒ seamless. flow is
 * pinned to 1 (keeps the engine's phase alive for pulse/sweep) and spin to 0;
 * the deeper Frame/Form motion belongs to the generator, not the filter.
 */
import { renderScanlines, GEOMETRY_OPTIONS, MARK_OPTIONS, CHARSET_OPTIONS } from '../loops/scanline/engine.js'
import { registerSourceCache } from './fxCore.js'

/* Downscaled luma sampler, cached by source-canvas identity — the host hands
 * us a NEW fitted canvas whenever the image / fit / size changes, so the
 * getImageData + buffer build runs once per source, not per frame. The engine
 * only needs a coarse density field; 160px across is plenty. */
const LUMA_W = 160
const lumaCache = new WeakMap()
registerSourceCache(lumaCache)   /* chain intermediates / loop sources invalidate in place */
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

/* `l` is the filter stage's own param bag (matches how runChain hands params
 * to `when`). Geometry gates mirror the loop def's. */
const isRows = (l) => (l.geometry ?? 'rows') === 'rows' || l.geometry === 'columns'

export default {
  id: 'scanline',
  label: 'Scanline',
  animated: true,
  params: [
    /* Geometry — the scan-path layout the marks accumulate along. */
    { key: 'geometry', label: 'Geometry', type: 'select', options: GEOMETRY_OPTIONS, default: 'rows' },
    { key: 'rows', label: 'Lines', type: 'range', min: 8, max: 260, step: 1, default: 120, when: isRows },
    { key: 'rayCount', label: 'Rays', type: 'range', min: 16, max: 520, step: 1, default: 200, when: (l) => l.geometry === 'radial' },
    { key: 'ringCount', label: 'Rings', type: 'range', min: 4, max: 200, step: 1, default: 60, when: (l) => l.geometry === 'rings' },
    { key: 'turns', label: 'Turns', type: 'range', min: 1, max: 30, step: 0.5, default: 6, when: (l) => l.geometry === 'spiral' },
    { key: 'arms', label: 'Arms', type: 'range', min: 1, max: 8, step: 1, default: 1, when: (l) => l.geometry === 'spiral' },
    { key: 'swirl', label: 'Swirl', type: 'range', min: -1, max: 1, step: 0.02, default: 0, when: (l) => l.geometry === 'radial' || l.geometry === 'rings' },
    { key: 'weave', label: 'Weave', type: 'toggle', default: false, when: isRows },
    /* Spacing — the cumulative-sum gap range + luma contrast. */
    { key: 'minGap', label: 'Min gap', type: 'range', min: 1, max: 24, step: 0.5, default: 3 },
    { key: 'maxGap', label: 'Max gap', type: 'range', min: 4, max: 64, step: 0.5, default: 22 },
    { key: 'contrast', label: 'Contrast', type: 'range', min: 0.3, max: 4, step: 0.05, default: 1.2 },
    { key: 'displace', label: 'Displace', type: 'range', min: 0, max: 1, step: 0.02, default: 0 },
    { key: 'invert', label: 'Invert', type: 'toggle', default: false },
    /* Mark — the glyph/dot/dash/lattice renderer over the marks. */
    { key: 'mark', label: 'Mark', type: 'select', options: MARK_OPTIONS, default: 'dots' },
    { key: 'markSize', label: 'Mark size', type: 'range', min: 0.2, max: 3, step: 0.05, default: 1, when: (l) => (l.mark ?? 'dots') !== 'glyph' },
    { key: 'dashLen', label: 'Dash length', type: 'range', min: 0.3, max: 3, step: 0.05, default: 1.2, when: (l) => l.mark === 'dash' },
    { key: 'charset', label: 'Charset', type: 'select', options: CHARSET_OPTIONS, default: 'ascii', when: (l) => l.mark === 'glyph' },
    { key: 'fontScale', label: 'Font size', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1, when: (l) => l.mark === 'glyph' },
    /* Color. */
    { key: 'bg', label: 'Background', type: 'color', default: '#06070b' },
    { key: 'fg', label: 'Ink', type: 'color', default: '#f4f1ea' },
    /* Motion — the seamless woven pulse/sweep (flow/spin stay internal). */
    { key: 'pulse', label: 'Pulse', type: 'range', min: 0, max: 1, step: 0.05, default: 0 },
    /* the engine's sweep wave skips the lattice mark */
    { key: 'sweep', label: 'Sweep', type: 'range', min: 0, max: 1, step: 0.05, default: 0, when: (l) => (l.mark ?? 'dots') !== 'lattice' },
  ],
  apply(ctx, src, w, h, p, u) {
    renderScanlines(ctx, u, w, h, {
      ...p,
      invert: !!p.invert,
      weave: !!p.weave,
      bg: p.bg ?? '#06070b',
      fg: p.fg ?? '#f4f1ea',
      /* flow=1 keeps the engine's phase ph = TAU·u alive so pulse/sweep
       * animate; spin/seed pinned — the procedural field the phase would
       * scroll is overridden by `sample`, so nothing else moves. */
      flow: 1,
      spin: 0,
      seed: 0,
      sample: lumaSampler(src),
    })
  },
}
