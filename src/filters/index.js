/**
 * Image-filter catalog (plan.md Phase 5 wave 4a) — filters that transform a
 * photo layer's pixels on a live <canvas>, same spirit as the loops contract.
 *
 * A Filter definition:
 *   {
 *     id:       string          unique, kebab-case
 *     label:    string          inspector dropdown label
 *     animated: bool            false = never subscribes to the transport
 *     params:   ParamSchema[]   same grammar as loops / editor schemas —
 *                               values ride FLAT on the photo layer, so
 *                               bindings + timeline work for free
 *     apply(ctx, src, w, h, p, u)
 *   }
 *
 * `src` is a canvas holding the FITTED source image at w×h CSS px (the host
 * rebuilds it as a NEW canvas when the image / fit / size changes — filters
 * key their per-source caches on canvas identity). `ctx` is the destination,
 * already dpr-transformed so 1 unit = 1 CSS px; a filter may draw src and
 * distort, or read src's pixels directly. `p` is the resolved layer (params
 * flat + `id`); `u` ∈ [0,1] is transport time.
 *
 * GL engine filters (wave 4c) add `kind: 'engine'` + `engine: '<key>'`
 * instead of `apply` — the renderer routes them to EngineFilterLayer and the
 * three.js engine loads lazily via ./gl/host.js (defs here stay data-only).
 */
import glass from './glass.js'
import scanline from './scanline.js'
import dither from './dither.js'
import { RADAR_FX } from './fxRadar.js'
import ascii from './fxAscii.js'
import halftoneDither from './fxHalftoneDither.js'
import bitmap from './fxBitmap.js'
import { EFFECTS_FX } from './fxEffects.js'
import { GL_FILTERS } from './gl/catalog.js'

export const FILTERS = [
  glass, scanline, dither,
  /* Radar canvas FX — labs radar/hooks/useCanvasFx.js (radar + live postfx chain) */
  ...RADAR_FX,
  /* HALFTONE trio — labs radar Dither/ASCII (+ shared sweep rig, sweeps.js)
     and optic Bitmap (photo-luma halftone field) */
  ascii, halftoneDither, bitmap,
  /* Effects canvas tier — labs pages/effects engine/canvasEffects.js over lib/imagefilters.js */
  ...EFFECTS_FX,
  /* GL engine filters — synths / distortion / lens (labs radar); lazy engines */
  ...GL_FILTERS,
]

export const filterById = (id) => FILTERS.find((f) => f.id === id) ?? null
