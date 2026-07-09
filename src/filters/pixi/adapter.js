// Pixi filter mapping layer — ported verbatim from labs
// (kol-labs-single/src/pages/effects/engine/pixiFilters.js).
//
// `createPixiFilter` is the {type, params} → pixi-filters instance switch. It's
// driven by pipeline.js, which chains the results on ONE persistent Pixi
// Application. Reached ONLY through pipeline.js's dynamic import(), so the
// static `pixi.js` / `pixi-filters` imports here code-split into their own
// chunk (never the main bundle).

import { DisplacementFilter } from 'pixi.js'
import {
  AdjustmentFilter,
  AdvancedBloomFilter,
  AsciiFilter,
  BackdropBlurFilter,
  BevelFilter,
  BloomFilter,
  BulgePinchFilter,
  ColorGradientFilter,
  ColorMapFilter,
  ColorOverlayFilter,
  ColorReplaceFilter,
  ConvolutionFilter,
  CrossHatchFilter,
  CRTFilter,
  DotFilter,
  DropShadowFilter,
  EmbossFilter,
  GlitchFilter,
  GlowFilter,
  GodrayFilter,
  GrayscaleFilter,
  HslAdjustmentFilter,
  KawaseBlurFilter,
  MotionBlurFilter,
  MultiColorReplaceFilter,
  OldFilmFilter,
  OutlineFilter,
  PixelateFilter,
  RadialBlurFilter,
  ReflectionFilter,
  RGBSplitFilter,
  ShockwaveFilter,
  SimpleLightmapFilter,
  SimplexNoiseFilter,
  TiltShiftFilter,
  TwistFilter,
  ZoomBlurFilter,
} from 'pixi-filters'

/**
 * Build a pixi-filters instance from this repo's effect id + params.
 * `displacementSprite` is the noise map sprite, only used by filter-displacement.
 *
 * NOTE: rgb-split params are flattened to redX/blueX in defs.js; this re-nests
 * them to the {red:{x},blue:{x}} shape RGBSplitFilter expects.
 */
export function createPixiFilter(filterType, params = {}, displacementSprite, dims = {}) {
  const w = dims.w || 1
  const h = dims.h || 1
  // Centre is exposed as normalised 0–1 (centerX/centerY). BulgePinch wants it
  // normalised; the pixel-space filters want canvas pixels — scale by dims.
  const normCentre = (p) => { const { centerX, centerY, ...rest } = p; return { rest, center: { x: centerX ?? 0.5, y: centerY ?? 0.5 } } }
  const pxCentre = (p) => { const { centerX, centerY, ...rest } = p; return { rest, center: { x: (centerX ?? 0.5) * w, y: (centerY ?? 0.5) * h } } }
  switch (filterType) {
    // Color Adjustments
    case 'filter-adjustment':
      return new AdjustmentFilter(params)
    case 'filter-hsl-adjustment':
      return new HslAdjustmentFilter(params)
    case 'filter-color-gradient':
      return new ColorGradientFilter(params)
    case 'filter-color-map':
      return new ColorMapFilter(params)
    case 'filter-color-overlay':
      return new ColorOverlayFilter(params)
    case 'filter-color-replace':
      return new ColorReplaceFilter(params)
    case 'filter-multi-color-replace': {
      // Schema flattens the replacement pairs to from1/to1…; re-nest to the
      // `replacements: [[from, to], …]` shape the filter expects.
      const { from1, to1, from2, to2, from3, to3, ...rest } = params
      const replacements = [
        [from1 ?? '#ff0000', to1 ?? '#ff0000'],
        [from2 ?? '#00ff00', to2 ?? '#00ff00'],
        [from3 ?? '#0000ff', to3 ?? '#0000ff'],
      ]
      return new MultiColorReplaceFilter({ ...rest, replacements })
    }

    // Blur
    case 'filter-radial-blur': {
      const { rest, center } = pxCentre(params)
      return new RadialBlurFilter({ ...rest, center })
    }
    case 'filter-zoom-blur': {
      const { rest, center } = pxCentre(params)
      return new ZoomBlurFilter({ ...rest, center })
    }
    case 'filter-motion-blur':
      return new MotionBlurFilter(params)
    case 'filter-kawase-blur':
      return new KawaseBlurFilter(params)
    case 'filter-tilt-shift':
      return new TiltShiftFilter(params)
    case 'filter-backdrop-blur':
      return new BackdropBlurFilter(params)

    // Displacement
    case 'filter-displacement':
      if (displacementSprite) {
        return new DisplacementFilter({
          sprite: displacementSprite,
          scale: { x: params.scaleX ?? 20, y: params.scaleY ?? 20 },
        })
      }
      return null

    // Distortion
    case 'filter-twist':
      return new TwistFilter(params)
    case 'filter-bulge-pinch': {
      const { rest, center } = normCentre(params)
      return new BulgePinchFilter({ ...rest, center })
    }
    case 'filter-shockwave': {
      const { rest, center } = pxCentre(params)
      return new ShockwaveFilter({ ...rest, center })
    }

    // Artistic
    case 'filter-ascii':
      return new AsciiFilter(params)
    case 'filter-cross-hatch':
      return new CrossHatchFilter(params)
    case 'filter-dot':
      return new DotFilter(params)
    case 'filter-crt':
      return new CRTFilter(params)
    case 'filter-old-film':
      return new OldFilmFilter(params)
    case 'filter-glitch':
      return new GlitchFilter(params)
    case 'filter-rgb-split': {
      const { redX = -10, blueX = 10, ...rest } = params
      return new RGBSplitFilter({ ...rest, red: { x: redX, y: 0 }, blue: { x: blueX, y: 0 } })
    }
    case 'filter-simplex-noise':
      return new SimplexNoiseFilter(params)

    // Lighting
    case 'filter-bloom':
      return new BloomFilter(params)
    case 'filter-advanced-bloom':
      return new AdvancedBloomFilter(params)
    case 'filter-glow':
      return new GlowFilter(params)
    case 'filter-godray': {
      const { rest, center } = pxCentre(params)
      return new GodrayFilter({ ...rest, center })
    }
    case 'filter-simple-lightmap':
      return new SimpleLightmapFilter(params)

    // Stylize
    case 'filter-bevel':
      return new BevelFilter(params)
    case 'filter-drop-shadow': {
      // v6 DropShadowFilter takes `offset:{x,y}` (no distance/rotation); the
      // schema flattens it to offsetX/offsetY — re-nest here.
      const { offsetX, offsetY, ...rest } = params
      return new DropShadowFilter({ ...rest, offset: { x: offsetX ?? 4, y: offsetY ?? 4 } })
    }
    case 'filter-outline':
      return new OutlineFilter(params)
    case 'filter-reflection':
      return new ReflectionFilter(params)

    // Utility
    case 'filter-convolution':
      return new ConvolutionFilter(params)
    case 'filter-emboss':
      return new EmbossFilter(params)
    case 'filter-grayscale':
      return new GrayscaleFilter(params)
    case 'filter-pixelate':
      return new PixelateFilter(params)

    default:
      return null
  }
}
