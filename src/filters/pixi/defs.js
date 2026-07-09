/**
 * Pixi GPU filter defs — the 35 `tier:'pixi'` effects from labs
 * (kol-labs-single/src/pages/effects/effects.config.js:67-298), reshaped into
 * the editor's filter-def grammar:
 *
 *   { id, label, kind:'pixi', group, params: ParamSchema[] }
 *
 * DATA ONLY — no pixi.js / pixi-filters import here, so this stays in the main
 * chunk (consumed eagerly by the registry + picker) while the engine (adapter.js
 * / pipeline.js) loads lazily via dynamic import when a pixi'd layer renders.
 *
 * `kind:'pixi'` routes the render/chain tier (filterChain.js): canvas stages →
 * pixi batch → terminal GL engine. Unlike `kind:'engine'`, multiple pixi stages
 * are allowed on one layer — they batch on the persistent Pixi Application.
 *
 * PARAM KEYS ARE VERBATIM from labs — the adapter (adapter.js) spreads them
 * straight into the pixi-filters constructors (with a few flattened exceptions
 * re-nested there: displacement scaleX/scaleY, rgb-split redX/blueX, drop-shadow
 * offsetX/offsetY, centre centerX/centerY, multi-color-replace fromN/toN).
 * Labels are authored Title Case (labs kept none — its params were object-keyed).
 * min/max/step/default are verbatim labs.
 */

const range = (key, label, min, max, step, dflt) => ({ key, label, type: 'range', min, max, step, default: dflt })
const color = (key, label, dflt) => ({ key, label, type: 'color', default: dflt })
// Boolean option → an Off/On segmented toggle (stores a real boolean).
const toggle = (key, label, dflt = false) => ({ key, label, type: 'toggle', default: dflt })
// Normalised 0–1 centre axis → the adapter maps it to the filter's center{x,y}.
const centre = (key, label) => range(key, label, 0, 1, 0.01, 0.5)

export const PIXI_FILTERS = [
  // ── Color Adjustments ──────────────────────────────────────────────────
  { id: 'filter-adjustment', label: 'Adjustment', kind: 'pixi', group: 'color-adjustments', params: [
    range('gamma', 'Gamma', 0, 2, 0.01, 1),
    range('saturation', 'Saturation', 0, 2, 0.01, 1),
    range('contrast', 'Contrast', 0, 2, 0.01, 1),
    range('brightness', 'Brightness', 0, 2, 0.01, 1),
    range('red', 'Red', 0, 2, 0.01, 1),
    range('green', 'Green', 0, 2, 0.01, 1),
    range('blue', 'Blue', 0, 2, 0.01, 1),
    range('alpha', 'Alpha', 0, 1, 0.01, 1),
  ] },
  { id: 'filter-hsl-adjustment', label: 'HSL Adjustment', kind: 'pixi', group: 'color-adjustments', params: [
    range('hue', 'Hue', -1, 1, 0.01, 0),
    range('saturation', 'Saturation', -1, 1, 0.01, 0),
    range('lightness', 'Lightness', -1, 1, 0.01, 0),
    range('alpha', 'Alpha', 0, 1, 0.01, 1),
    toggle('colorize', 'Colorize', false),
  ] },
  { id: 'filter-color-gradient', label: 'Color Gradient', kind: 'pixi', group: 'color-adjustments', params: [] },
  { id: 'filter-color-map', label: 'Color Map', kind: 'pixi', group: 'color-adjustments', params: [] },
  { id: 'filter-color-overlay', label: 'Color Overlay', kind: 'pixi', group: 'color-adjustments', params: [
    color('color', 'Color', '#ff0000'),
    range('alpha', 'Alpha', 0, 1, 0.01, 1),
  ] },
  { id: 'filter-color-replace', label: 'Color Replace', kind: 'pixi', group: 'color-adjustments', params: [
    color('originalColor', 'Original color', '#ff0000'),
    color('targetColor', 'Target color', '#000000'),
    range('tolerance', 'Tolerance', 0, 1, 0.01, 0.4),
  ] },
  { id: 'filter-multi-color-replace', label: 'Multi Color Replace', kind: 'pixi', group: 'color-adjustments', params: [
    color('from1', 'From 1', '#ff0000'), color('to1', 'To 1', '#ff0000'),
    color('from2', 'From 2', '#00ff00'), color('to2', 'To 2', '#00ff00'),
    color('from3', 'From 3', '#0000ff'), color('to3', 'To 3', '#0000ff'),
    range('tolerance', 'Tolerance', 0, 1, 0.01, 0.1),
  ] },

  // ── Blur & Sharpen ─────────────────────────────────────────────────────
  { id: 'filter-radial-blur', label: 'Radial Blur', kind: 'pixi', group: 'blur-sharpen', params: [
    range('angle', 'Angle', 0, 20, 0.1, 0),
    { ...range('kernelSize', 'Kernel size', 3, 25, 2, 5), noRandom: true },
    centre('centerX', 'Center X'), centre('centerY', 'Center Y'),
  ] },
  { id: 'filter-zoom-blur', label: 'Zoom Blur', kind: 'pixi', group: 'blur-sharpen', params: [
    range('strength', 'Strength', 0, 1, 0.01, 0.1),
    range('innerRadius', 'Inner radius', 0, 500, 1, 0),
    centre('centerX', 'Center X'), centre('centerY', 'Center Y'),
  ] },
  { id: 'filter-motion-blur', label: 'Motion Blur', kind: 'pixi', group: 'blur-sharpen', params: [
    range('velocityX', 'Velocity X', -50, 50, 1, 0),
    range('velocityY', 'Velocity Y', -50, 50, 1, 5),
    { ...range('kernelSize', 'Kernel size', 5, 25, 2, 5), noRandom: true },
    range('offset', 'Offset', -50, 50, 1, 0),
  ] },
  { id: 'filter-kawase-blur', label: 'Kawase Blur', kind: 'pixi', group: 'blur-sharpen', params: [
    range('blur', 'Blur', 0, 20, 1, 4),
    range('quality', 'Quality', 1, 10, 1, 3),
  ] },
  { id: 'filter-tilt-shift', label: 'Tilt Shift', kind: 'pixi', group: 'blur-sharpen', params: [
    range('blur', 'Blur', 0, 200, 1, 100),
    range('gradientBlur', 'Gradient blur', 0, 1000, 10, 600),
  ] },
  { id: 'filter-backdrop-blur', label: 'Backdrop Blur', kind: 'pixi', group: 'blur-sharpen', params: [] },

  // ── Distortion (incl. labs Displacement) ───────────────────────────────
  { id: 'filter-displacement', label: 'Displacement Map', kind: 'pixi', group: 'distortion', params: [
    range('scaleX', 'Scale X', 0, 200, 1, 20),
    range('scaleY', 'Scale Y', 0, 200, 1, 20),
    range('frequency', 'Frequency', 0.1, 10, 0.1, 1),
    range('octaves', 'Octaves', 1, 8, 1, 3),
    range('persistence', 'Persistence', 0, 1, 0.01, 0.5),
  ] },
  { id: 'filter-twist', label: 'Twist', kind: 'pixi', group: 'distortion', params: [
    range('radius', 'Radius', 0, 500, 1, 200),
    range('angle', 'Angle', -10, 10, 0.1, 4),
    range('padding', 'Padding', 0, 100, 1, 20),
  ] },
  { id: 'filter-bulge-pinch', label: 'Bulge/Pinch', kind: 'pixi', group: 'distortion', params: [
    range('radius', 'Radius', 0, 500, 1, 100),
    range('strength', 'Strength', -3, 3, 0.1, 1),
    centre('centerX', 'Center X'), centre('centerY', 'Center Y'),
  ] },
  { id: 'filter-shockwave', label: 'Shockwave', kind: 'pixi', group: 'distortion', params: [
    range('amplitude', 'Amplitude', 0, 100, 1, 30),
    range('wavelength', 'Wavelength', 10, 500, 1, 160),
    range('speed', 'Speed', 0, 2000, 10, 500),
    range('brightness', 'Brightness', 0, 2, 0.05, 1),
    range('time', 'Time', 0, 20, 0.1, 1),
    centre('centerX', 'Center X'), centre('centerY', 'Center Y'),
  ] },

  // ── Artistic ───────────────────────────────────────────────────────────
  { id: 'filter-ascii', label: 'ASCII', kind: 'pixi', group: 'artistic', params: [
    range('size', 'Size', 2, 20, 1, 8),
    toggle('replaceColor', 'Replace color', false),
  ] },
  { id: 'filter-cross-hatch', label: 'Cross Hatch', kind: 'pixi', group: 'artistic', params: [] },
  { id: 'filter-dot', label: 'Dot Screen', kind: 'pixi', group: 'artistic', params: [
    range('scale', 'Scale', 0.1, 5, 0.1, 1),
    range('angle', 'Angle', 0, 360, 1, 5),
    toggle('grayscale', 'Grayscale', true),
  ] },
  { id: 'filter-crt', label: 'CRT', kind: 'pixi', group: 'artistic', params: [
    range('curvature', 'Curvature', 0, 10, 0.1, 1),
    range('lineWidth', 'Line width', 0, 5, 0.1, 1),
    range('lineContrast', 'Line contrast', 0, 1, 0.01, 0.25),
    range('noise', 'Noise', 0, 1, 0.01, 0.3),
    range('noiseSize', 'Noise size', 0, 10, 0.1, 1),
    range('vignetting', 'Vignetting', 0, 1, 0.01, 0.3),
    range('vignettingAlpha', 'Vignetting alpha', 0, 1, 0.01, 1),
    range('vignettingBlur', 'Vignetting blur', 0, 1, 0.01, 0.3),
    range('time', 'Time', 0, 20, 0.1, 0),
    toggle('verticalLine', 'Vertical line', false),
  ] },
  { id: 'filter-old-film', label: 'Old Film', kind: 'pixi', group: 'artistic', params: [
    range('sepia', 'Sepia', 0, 1, 0.01, 0.3),
    range('noise', 'Noise', 0, 1, 0.01, 0.3),
    range('noiseSize', 'Noise size', 0, 10, 0.1, 1),
    range('scratch', 'Scratch', 0, 1, 0.01, 0.5),
    range('scratchDensity', 'Scratch density', 0, 1, 0.01, 0.3),
    range('scratchWidth', 'Scratch width', 0, 20, 0.5, 1),
    range('vignetting', 'Vignetting', 0, 1, 0.01, 0.3),
    range('vignettingAlpha', 'Vignetting alpha', 0, 1, 0.01, 1),
    range('vignettingBlur', 'Vignetting blur', 0, 1, 0.01, 0.3),
  ] },
  { id: 'filter-glitch', label: 'Glitch', kind: 'pixi', group: 'artistic', params: [
    range('slices', 'Slices', 1, 50, 1, 5),
    range('offset', 'Offset', 0, 500, 1, 100),
    range('direction', 'Direction', 0, 360, 1, 0),
    range('seed', 'Seed', 0, 1, 0.01, 0),
    range('minSize', 'Min size', 1, 50, 1, 8),
    { ...range('sampleSize', 'Sample size', 256, 2048, 256, 512), noRandom: true },
    { key: 'fillMode', label: 'Fill mode', type: 'select', numeric: true, noRandom: true, default: 0, options: [
      { value: 0, label: 'Transparent' }, { value: 1, label: 'Original' }, { value: 2, label: 'Loop' },
      { value: 3, label: 'Clamp' }, { value: 4, label: 'Mirror' },
    ] },
    toggle('average', 'Average', false),
  ] },
  { id: 'filter-rgb-split', label: 'RGB Split', kind: 'pixi', group: 'artistic', params: [
    range('redX', 'Red X', -50, 50, 1, -10),
    range('blueX', 'Blue X', -50, 50, 1, 10),
  ] },
  { id: 'filter-simplex-noise', label: 'Simplex Noise', kind: 'pixi', group: 'artistic', params: [
    range('strength', 'Strength', 0, 1, 0.01, 0.5),
    range('noiseScale', 'Noise scale', 0, 50, 0.5, 10),
    range('offsetX', 'Offset X', -100, 100, 1, 0),
    range('offsetY', 'Offset Y', -100, 100, 1, 0),
    range('offsetZ', 'Offset Z', -100, 100, 1, 0),
    range('step', 'Step', -1, 1, 0.01, -1),
  ] },

  // ── Lighting ───────────────────────────────────────────────────────────
  { id: 'filter-bloom', label: 'Bloom', kind: 'pixi', group: 'lighting', params: [
    range('blur', 'Blur', 0, 20, 1, 2),
    range('strength', 'Strength', 0, 5, 0.1, 1),
  ] },
  { id: 'filter-advanced-bloom', label: 'Advanced Bloom', kind: 'pixi', group: 'lighting', params: [
    range('threshold', 'Threshold', 0, 1, 0.01, 0.5),
    range('bloomScale', 'Bloom scale', 0, 3, 0.1, 1),
    range('brightness', 'Brightness', 0, 2, 0.1, 1),
    range('blur', 'Blur', 0, 20, 1, 8),
    range('quality', 'Quality', 1, 10, 1, 4),
  ] },
  { id: 'filter-glow', label: 'Glow', kind: 'pixi', group: 'lighting', params: [
    range('distance', 'Distance', 0, 50, 1, 10),
    range('outerStrength', 'Outer strength', 0, 20, 1, 4),
    range('innerStrength', 'Inner strength', 0, 20, 0.5, 0),
    range('alpha', 'Alpha', 0, 1, 0.01, 1),
    range('quality', 'Quality', 0.1, 1, 0.05, 0.1),
    color('color', 'Color', '#ffffff'),
  ] },
  { id: 'filter-godray', label: 'God Ray', kind: 'pixi', group: 'lighting', params: [
    range('angle', 'Angle', 0, 90, 1, 30),
    range('gain', 'Gain', 0, 1, 0.01, 0.5),
    range('lacunarity', 'Lacunarity', 0, 5, 0.1, 2.5),
    range('alpha', 'Alpha', 0, 1, 0.01, 1),
    range('time', 'Time', 0, 20, 0.1, 0),
    toggle('parallel', 'Parallel', true),
    centre('centerX', 'Center X'), centre('centerY', 'Center Y'),
  ] },
  { id: 'filter-simple-lightmap', label: 'Simple Lightmap', kind: 'pixi', group: 'lighting', params: [] },

  // ── Stylize ────────────────────────────────────────────────────────────
  { id: 'filter-bevel', label: 'Bevel', kind: 'pixi', group: 'stylize', params: [
    range('thickness', 'Thickness', 0, 20, 1, 2),
    range('rotation', 'Rotation', 0, 360, 1, 45),
    color('lightColor', 'Light color', '#ffffff'),
    range('lightAlpha', 'Light alpha', 0, 1, 0.01, 0.7),
    color('shadowColor', 'Shadow color', '#000000'),
    range('shadowAlpha', 'Shadow alpha', 0, 1, 0.01, 0.7),
  ] },
  { id: 'filter-drop-shadow', label: 'Drop Shadow', kind: 'pixi', group: 'stylize', params: [
    range('offsetX', 'Offset X', -50, 50, 1, 4),
    range('offsetY', 'Offset Y', -50, 50, 1, 4),
    range('blur', 'Blur', 0, 20, 1, 2),
    range('alpha', 'Alpha', 0, 1, 0.01, 0.5),
    range('quality', 'Quality', 0, 10, 1, 3),
    color('color', 'Color', '#000000'),
    toggle('shadowOnly', 'Shadow only', false),
  ] },
  { id: 'filter-outline', label: 'Outline', kind: 'pixi', group: 'stylize', params: [
    range('thickness', 'Thickness', 0, 20, 1, 1),
    color('color', 'Color', '#000000'),
    range('alpha', 'Alpha', 0, 1, 0.01, 1),
    range('quality', 'Quality', 0.05, 1, 0.05, 0.1),
    toggle('knockout', 'Knockout', false),
  ] },
  { id: 'filter-reflection', label: 'Reflection', kind: 'pixi', group: 'stylize', params: [
    range('boundary', 'Boundary', 0, 1, 0.01, 0.5),
    range('time', 'Time', 0, 20, 0.1, 0),
    toggle('mirror', 'Mirror', true),
  ] },

  // ── Utility ────────────────────────────────────────────────────────────
  { id: 'filter-convolution', label: 'Convolution', kind: 'pixi', group: 'utility', params: [] },
]
