/**
 * lookPresets — the labs LOOK recipes (palette / iridescence combos applied on
 * top of any preset) as loop-keyed param patches. Data only; the Parameters
 * panel surfaces them as a Look dropdown whose pick patches the layer.
 *
 * Ported from kol-labs-single softforms/registry.js LOOK_PRESETS — the ONE
 * list both the 2D SoftFormsPage and SoftForms3DPage read (the 3D page imports
 * it from the 2D registry). Patch keys are editor schema keys (palette /
 * spectral / hue / irid / rim — all in the shared SOFTFORMS_PARAMS).
 *
 * Iridescent is deliberately absent: its catalog def already carries a `look`
 * param (GRAD_LOOKS recipes overlaid engine-side on every setParams).
 */

const SOFTFORMS_LOOKS = {
  Spectrum: { palette: 'spectrum', spectral: true, hue: 0, irid: 1.1 },
  Iris:     { palette: 'iris', spectral: false, hue: 0.1, irid: 1.05 },
  Aqua:     { palette: 'aqua', spectral: false, hue: 0.5, irid: 1.0 },
  Magma:    { palette: 'magma', spectral: false, hue: 0.05, irid: 0.95 },
  Candy:    { palette: 'candy', spectral: false, hue: 0.8, irid: 1.15 },
  Noir:     { palette: 'spectrum', spectral: true, hue: 0, irid: 0.6, rim: 1.0 },
}

/** Look recipes for a loop id → { Name: paramPatch } (null = no look level). */
export function lookPresetsFor(loopId) {
  if (loopId === 'softforms' || loopId === 'softforms3d') return SOFTFORMS_LOOKS
  return null
}
