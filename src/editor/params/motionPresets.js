import { loopById } from '../../loops/registry'

// Motion Frame/Form preset tables — the labs quick-select model (ScanlineEditor /
// PatternControls / WaveformsEditor / SurfacesEditor / FieldsEditor), keyed by
// loop id. Frame = the whole figure/pattern moves · Form = it modulates in
// place. A preset's `params` patches ONLY its own axis so the two compose;
// 'static' is the real motion-off. Editing any slider an axis covers flips
// that axis's dropdown to the display-only 'Custom' state (ParametersPanel).
//
// Values are the labs tables translated to the EDITOR schemas — every key
// verified against the loop def; params the editor never ported (labs drift
// angle, sway/tilt/dolly, formSpeed) are dropped or mapped to the nearest
// legal quantized value (see per-table notes). Glass/filter loops are out of
// scope (filter layers — Effects tab domain).

/* ── Scanline (labs ScanlineEditor.jsx FRAME/FORM_PRESETS) ─────────────────
 * Editor flow/spin are integer cycles/turns (seamless-loop quantization):
 * labs spin 0.6 → 1. Labs Reverse/Down patched the drift ANGLE, which the
 * editor engine removed (the noise scroll became a directionless orbit) —
 * without it they'd duplicate Drift, so they're not ported. */
const SCANLINE = {
  frame: [
    { id: 'static', label: 'Static', params: { flow: 0 } },
    { id: 'drift',  label: 'Drift',  params: { flow: 1, spin: 0 } },
    { id: 'spin',   label: 'Spin',   params: { flow: 1, spin: 1 } },
    { id: 'rush',   label: 'Rush',   params: { flow: 2, spin: 0 } },
  ],
  form: [
    { id: 'static',  label: 'Static',  params: { sweep: 0, pulse: 0 } },
    { id: 'sweep',   label: 'Sweep',   params: { sweep: 0.6, pulse: 0 } },
    { id: 'breathe', label: 'Breathe', params: { sweep: 0, pulse: 0.5 } },
    { id: 'ripple',  label: 'Ripple',  params: { sweep: 0.5, pulse: 0.4 } },
  ],
}

/* ── Pattern loop (labs PatternControls.jsx, verbatim) ─────────────────────
 * Tables picked per render kind exactly like labs: tiles → tile pan + per-cell
 * sweep; field → band frame (organic gets the two-axis variant) + per-band
 * form; weave → band frame + per-crossing pulse/fade. */
const PATTERN_TILE_FRAME = [
  { id: 'static',    label: 'Static',    params: { camFlow: 0 } },
  { id: 'pan-right', label: 'Pan Right', params: { camFlow: 1, panDir: 'right' } },
  { id: 'pan-left',  label: 'Pan Left',  params: { camFlow: 1, panDir: 'left' } },
  { id: 'pan-up',    label: 'Pan Up',    params: { camFlow: 1, panDir: 'up' } },
  { id: 'pan-down',  label: 'Pan Down',  params: { camFlow: 1, panDir: 'down' } },
  { id: 'drift',     label: 'Drift',     params: { camFlow: 1, panDir: 'diag' } },
  { id: 'glide',     label: 'Glide',     params: { camFlow: 2, panDir: 'anti' } },
]
const PATTERN_TILE_FORM = [
  { id: 'static',       label: 'Static',       params: { spin: 0, animAxis: 'none',   animCycles: 1, animWaves: 2, pulse: 0,   fade: 0,   swing: 0,  colorMix: 0 } },
  { id: 'spin',         label: 'Spin',         params: { spin: 1, animAxis: 'none',   animCycles: 1, animWaves: 2, pulse: 0,   fade: 0,   swing: 0,  colorMix: 0 } },
  { id: 'breathe',      label: 'Breathe',      params: { spin: 0, animAxis: 'radial', animCycles: 1, animWaves: 2, pulse: 0.6, fade: 0,   swing: 0,  colorMix: 0 } },
  { id: 'pulse-wave',   label: 'Pulse Wave',   params: { spin: 0, animAxis: 'diag',   animCycles: 1, animWaves: 3, pulse: 0.7, fade: 0,   swing: 0,  colorMix: 0 } },
  { id: 'fade-wave',    label: 'Fade Wave',    params: { spin: 0, animAxis: 'col',    animCycles: 1, animWaves: 2, pulse: 0,   fade: 0.8, swing: 0,  colorMix: 0 } },
  { id: 'sway',         label: 'Sway',         params: { spin: 0, animAxis: 'diag',   animCycles: 1, animWaves: 2, pulse: 0,   fade: 0,   swing: 60, colorMix: 0 } },
  { id: 'colour-sweep', label: 'Colour Sweep', params: { spin: 0, animAxis: 'diag',   animCycles: 1, animWaves: 2, pulse: 0,   fade: 0,   swing: 0,  colorMix: 1 } },
  { id: 'ripple',       label: 'Ripple',       params: { spin: 0, animAxis: 'radial', animCycles: 1, animWaves: 4, pulse: 0.5, fade: 0.5, swing: 0,  colorMix: 0 } },
]
const PATTERN_FIELD_FRAME = [
  { id: 'static',   label: 'Static',   params: { camFlow: 0, panDir: 'right' } },
  { id: 'drift',    label: 'Drift',    params: { camFlow: 1, panDir: 'right' } },
  { id: 'reverse',  label: 'Reverse',  params: { camFlow: 1, panDir: 'left' } },
  { id: 'glide',    label: 'Glide',    params: { camFlow: 2, panDir: 'right' } },
  { id: 'rush',     label: 'Rush',     params: { camFlow: 3, panDir: 'right' } },
  { id: 'bias',     label: 'Bias',     params: { camFlow: 1, panDir: 'right', stripeAngle: 30 } },
  { id: 'diagonal', label: 'Diagonal', params: { camFlow: 1, panDir: 'right', stripeAngle: 45 } },
  { id: 'counter',  label: 'Counter',  params: { camFlow: 1, panDir: 'right', stripeAngle: 135 } },
]
const PATTERN_ORGANIC_FRAME = [
  { id: 'static',   label: 'Static',   params: { camFlow: 0, waveFlow: 0, panDir: 'right' } },
  { id: 'drift',    label: 'Drift',    params: { camFlow: 1, waveFlow: 0, panDir: 'right' } },
  { id: 'travel',   label: 'Travel',   params: { camFlow: 0, waveFlow: 1, panDir: 'right' } },
  { id: 'both',     label: 'Both',     params: { camFlow: 1, waveFlow: 1, panDir: 'right' } },
  { id: 'reverse',  label: 'Reverse',  params: { camFlow: 1, waveFlow: 0, panDir: 'left' } },
  { id: 'glide',    label: 'Glide',    params: { camFlow: 1, waveFlow: 2, panDir: 'right' } },
  { id: 'diagonal', label: 'Diagonal', params: { camFlow: 1, waveFlow: 1, panDir: 'right', stripeAngle: 45 } },
]
const PATTERN_BAND_FORM = [
  { id: 'static',    label: 'Static',    params: { fieldSway: 0,    fieldStagger: 0,   fieldCycles: 1 } },
  { id: 'sway',      label: 'Sway',      params: { fieldSway: 0.5,  fieldStagger: 0.3, fieldCycles: 1 } },
  { id: 'alternate', label: 'Alternate', params: { fieldSway: 0.6,  fieldStagger: 1,   fieldCycles: 1 } },
  { id: 'ripple',    label: 'Ripple',    params: { fieldSway: 0.45, fieldStagger: 0.5, fieldCycles: 1 } },
]
const PATTERN_WEAVE_FORM = [
  { id: 'static', label: 'Static', params: { animAxis: 'none',   animCycles: 1, animWaves: 2, pulse: 0,   fade: 0 } },
  { id: 'pulse',  label: 'Pulse',  params: { animAxis: 'diag',   animCycles: 1, animWaves: 3, pulse: 0.6, fade: 0 } },
  { id: 'fade',   label: 'Fade',   params: { animAxis: 'col',    animCycles: 1, animWaves: 2, pulse: 0,   fade: 0.7 } },
  { id: 'ripple', label: 'Ripple', params: { animAxis: 'radial', animCycles: 1, animWaves: 4, pulse: 0.4, fade: 0.4 } },
]

/* ── Math · Waveforms (labs WaveformsEditor.jsx, verbatim — formSpeed never
 * existed on this table; all keys match the editor schema) ──────────────── */
const WAVEFORM = {
  frame: [
    { id: 'static',   label: 'Static',   params: { flow: 0 } },
    { id: 'drift',    label: 'Drift',    params: { flow: 1, panDir: 'right' } },
    { id: 'reverse',  label: 'Reverse',  params: { flow: 1, panDir: 'left' } },
    { id: 'rise',     label: 'Rise',     params: { flow: 1, panDir: 'up' } },
    { id: 'fall',     label: 'Fall',     params: { flow: 1, panDir: 'down' } },
    { id: 'diagonal', label: 'Diagonal', params: { flow: 1, panDir: 'diag' } },
    { id: 'glide',    label: 'Glide',    params: { flow: 2, panDir: 'anti' } },
    { id: 'rush',     label: 'Rush',     params: { flow: 3, panDir: 'right' } },
  ],
  form: [
    { id: 'static',  label: 'Static',  params: { speed: 0,    stagger: 0,    pulse: 0,   fade: 0,   swing: 0 } },
    { id: 'scroll',  label: 'Scroll',  params: { speed: 0.45, stagger: 0,    pulse: 0,   fade: 0,   swing: 0 } },
    { id: 'morph',   label: 'Morph',   params: { speed: 0.3,  stagger: 0.5,  pulse: 0,   fade: 0,   swing: 0 } },
    { id: 'sway',    label: 'Sway',    params: { speed: 0.3,  stagger: 0,    pulse: 0,   fade: 0,   swing: 30 } },
    { id: 'breathe', label: 'Breathe', params: { speed: 0.3,  stagger: 0,    pulse: 0.6, fade: 0,   swing: 0 } },
    { id: 'shimmer', label: 'Shimmer', params: { speed: 0.4,  stagger: 0,    pulse: 0,   fade: 0.7, swing: 0 } },
    { id: 'rich',    label: 'Rich',    params: { speed: 0.4,  stagger: 0.35, pulse: 0.4, fade: 0.3, swing: 18 } },
  ],
}

/* ── Math · Surfaces (labs SurfacesEditor.jsx) ─────────────────────────────
 * The editor kept ONE camera-motion param (spin, integer orbit turns 0..3) —
 * labs sway/tilt/dolly weren't ported, so Rock/Survey/Push have nothing to
 * patch and Reverse can't go below 0 turns; those four are not ported. Labs
 * deg/s spins map to turns: orbit(8)→1 · spin(20)→2. Form drops the
 * unported formSpeed master; morph/ripple/fade match 1:1. */
const SURFACE = {
  frame: [
    { id: 'static', label: 'Static', params: { spin: 0 } },
    { id: 'orbit',  label: 'Orbit',  params: { spin: 1 } },
    { id: 'spin',   label: 'Spin',   params: { spin: 2 } },
  ],
  form: [
    { id: 'static',  label: 'Static',  params: { morph: 0,    ripple: 0,   fade: 0 } },
    { id: 'breathe', label: 'Breathe', params: { morph: 0.25, ripple: 0,   fade: 0 } },
    { id: 'pulse',   label: 'Pulse',   params: { morph: 0.5,  ripple: 0,   fade: 0 } },
    { id: 'ripple',  label: 'Ripple',  params: { morph: 0,    ripple: 0.6, fade: 0 } },
    { id: 'shimmer', label: 'Shimmer', params: { morph: 0,    ripple: 0,   fade: 0.6 } },
    { id: 'rich',    label: 'Rich',    params: { morph: 0.3,  ripple: 0.4, fade: 0.3 } },
  ],
}

/* ── Math · Fields (labs FieldsEditor.jsx, keyed on kind; formSpeed dropped —
 * the editor bakes rates into whole loop cycles) ─────────────────────────── */
const FIELD_SCALAR = {
  frame: [
    { id: 'static', label: 'Static', params: { flowSpeed: 0,   swirl: 0,   drift: 0 } },
    { id: 'drift',  label: 'Drift',  params: { flowSpeed: 1,   swirl: 0,   drift: 0 } },
    { id: 'wind',   label: 'Wind',   params: { flowSpeed: 1,   swirl: 0,   drift: 0.6, driftDir: 'right' } },
    { id: 'vortex', label: 'Vortex', params: { flowSpeed: 1,   swirl: 0.5, drift: 0 } },
    { id: 'rush',   label: 'Rush',   params: { flowSpeed: 2.4, swirl: 0,   drift: 0 } },
  ],
  form: [
    { id: 'lines',   label: 'Lines',   params: { dots: false, pulse: 0,   jitter: 0 } },
    { id: 'dots',    label: 'Dots',    params: { dots: true,  pulse: 0,   jitter: 0 } },
    { id: 'pulse',   label: 'Pulse',   params: { dots: false, pulse: 0.6, jitter: 0 } },
    { id: 'shimmer', label: 'Shimmer', params: { dots: true,  pulse: 0.3, jitter: 0.5 } },
  ],
}
const FIELD_COMPLEX = {
  frame: [
    { id: 'static',  label: 'Static',  params: { hueSpeed: 0,   cspin: 0,   czoom: 0 } },
    { id: 'cycle',   label: 'Cycle',   params: { hueSpeed: 1,   cspin: 0,   czoom: 0 } },
    { id: 'turn',    label: 'Turn',    params: { hueSpeed: 0.4, cspin: 0.6, czoom: 0 } },
    { id: 'breathe', label: 'Breathe', params: { hueSpeed: 0.4, cspin: 0,   czoom: 0.6 } },
    { id: 'rush',    label: 'Rush',    params: { hueSpeed: 2,   cspin: 1,   czoom: 0 } },
  ],
  form: [
    { id: 'static', label: 'Static', params: { ringSpeed: 0,   shade: 0 } },
    { id: 'rings',  label: 'Rings',  params: { ringSpeed: 1,   shade: 0 } },
    { id: 'pulse',  label: 'Pulse',  params: { ringSpeed: 1,   shade: 0.4 } },
    { id: 'fast',   label: 'Fast',   params: { ringSpeed: 2.4, shade: 0 } },
  ],
}

/* ── Viewport camera (labs LoopsShell.jsx FRAME/FORM_PRESETS, verbatim) ────
 * The universal 2d camera the contract layer folds onto shape + pattern-rules
 * defs (loops/contract.js → loops/lib/viewport.js). Frame = the whole loop
 * moves (spin/zoom) · Form = it modulates in place (pulse/wobble). Loops with
 * their OWN tables above (pattern-rules, scanline, the math family) keep
 * them — this is the default for vp-carrying loops without native motion. */
const VIEWPORT = {
  frame: [
    { id: 'static', label: 'Static',  params: { vpSpin: 0, vpZoom: 1 } },
    { id: 'spin',   label: 'Spin',    params: { vpSpin: 1, vpZoom: 1 } },
    { id: 'spin2',  label: 'Spin ×2', params: { vpSpin: 2, vpZoom: 1 } },
    { id: 'push',   label: 'Push in', params: { vpSpin: 0, vpZoom: 1.3 } },
  ],
  form: [
    { id: 'static',  label: 'Static',  params: { vpPulse: 0, vpWobble: 0 } },
    { id: 'pulse',   label: 'Pulse',   params: { vpPulse: 0.3, vpWobble: 0 } },
    { id: 'wobble',  label: 'Wobble',  params: { vpPulse: 0, vpWobble: 8 } },
    { id: 'breathe', label: 'Breathe', params: { vpPulse: 0.22, vpWobble: 5 } },
  ],
}

/**
 * The Frame/Form tables for a loop layer, or null when the loop has none.
 * Pattern + math-field resolve per layer state (render/field kind), exactly
 * like the labs controls did.
 */
export function motionPresetsFor(loopId, layer = {}) {
  switch (loopId) {
    case 'scanline':
      return SCANLINE
    case 'pattern-rules': {
      const render = layer.render ?? 'tiles'
      const organic = render === 'field' && layer.field === 'organic'
      return {
        frame: render === 'tiles' ? PATTERN_TILE_FRAME : organic ? PATTERN_ORGANIC_FRAME : PATTERN_FIELD_FRAME,
        form: render === 'tiles' ? PATTERN_TILE_FORM : render === 'weave' ? PATTERN_WEAVE_FORM : PATTERN_BAND_FORM,
      }
    }
    case 'math-waveform':
      return WAVEFORM
    case 'math-surface':
      return SURFACE
    case 'math-field':
      return (layer.kind ?? 'scalar') === 'complex' ? FIELD_COMPLEX : FIELD_SCALAR
    default:
      /* vp-carrying defs (contract.js fold) without native tables → the labs
       * viewport Frame/Form presets. */
      return loopById(loopId)?.params?.some((q) => q.key === 'vpSpin') ? VIEWPORT : null
  }
}

/** Union of param keys an axis's presets patch — editing any of these flips
 * that axis's dropdown to 'Custom'. */
export function axisKeys(presets) {
  const keys = new Set()
  for (const p of presets ?? []) for (const k of Object.keys(p.params ?? {})) keys.add(k)
  return keys
}
