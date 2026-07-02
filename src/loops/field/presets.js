// Field loops — continuous per-pixel fields (plasma / rings / stripes / swirl).
// Base draw-fn modules + the picker presets. A preset names a base loop + a
// partial param override. Add a base loop to FIELD_LOOPS, picker entries to
// FIELD_PRESETS.

import gradientField from './gradientField.js'
import halftone from './halftone.js'
import stripes from './stripes.js'
import checkerField from './checkerField.js'
import moire from './moire.js'
import ringsField from './ringsField.js'
import swirl from './swirl.js'
import interference from './interference.js'
import plasma from './plasma.js'
import contour from './contour.js'

export const FIELD_LOOPS = [
  gradientField, halftone, stripes, checkerField, moire,
  ringsField, swirl, interference, plasma, contour,
]

const P = (id, label, loop, params = {}, sub) => ({ id, label, loop, params, sub })

export const FIELD_PRESETS = [
  // Bands
  P('stripes', 'Stripes', 'stripes', {}, 'Bands'),
  P('stripes-hard', 'Stripes · hard', 'stripes', { sharp: 0.9, freq: 10 }, 'Bands'),
  P('checker-field', 'Checker field', 'checker-field', {}, 'Bands'),
  P('checker-soft', 'Checker · soft', 'checker-field', { soft: 0.7, colB: '#5a7fb0' }, 'Bands'),
  P('halftone', 'Halftone', 'halftone', {}, 'Bands'),
  P('halftone-warm', 'Halftone · warm', 'halftone', { dot: '#f6c453' }, 'Bands'),
  // Plasma
  P('gradient-field', 'Gradient field', 'gradient-field', {}, 'Plasma'),
  P('gradient-sunset', 'Gradient · sunset', 'gradient-field', { colA: '#2b1055', colB: '#d7263d', colC: '#f6c453' }, 'Plasma'),
  P('plasma', 'Plasma', 'plasma', {}, 'Plasma'),
  P('plasma-ice', 'Plasma · ice', 'plasma', { colA: '#06283d', colB: '#2a8f8f', colC: '#f4f1ea' }, 'Plasma'),
  // Rings
  P('rings-field', 'Rings field', 'rings-field', {}, 'Rings'),
  P('rings-mono', 'Rings · mono', 'rings-field', { colA: '#0b0b0e', colB: '#6b6b6b', colC: '#f4f1ea' }, 'Rings'),
  P('interference', 'Interference', 'interference', {}, 'Rings'),
  P('interference-5', 'Interference · 5', 'interference', { sources: 5, colB: '#7a3fb0' }, 'Rings'),
  // Swirl
  P('swirl', 'Swirl', 'swirl', {}, 'Swirl'),
  P('swirl-8', 'Swirl · 8 arms', 'swirl', { arms: 8, colB: '#2a8f8f' }, 'Swirl'),
  P('swirl-tight', 'Swirl · tight', 'swirl', { arms: 3, twist: 6, colB: '#c2502e', colC: '#f6c453' }, 'Swirl'),
  P('swirl-mono', 'Swirl · mono', 'swirl', { arms: 6, twist: 2, colB: '#6b6b6b', colC: '#f4f1ea' }, 'Swirl'),
  // Moiré
  P('moire', 'Moiré', 'moire', {}, 'Moiré'),
  P('moire-warm', 'Moiré · warm', 'moire', { colB: '#c2502e', colC: '#f6c453', freq2: 9 }, 'Moiré'),
  P('moire-tight', 'Moiré · tight', 'moire', { freq1: 11, freq2: 12, colB: '#2a8f8f' }, 'Moiré'),
  P('moire-wide', 'Moiré · wide', 'moire', { freq1: 3, freq2: 4.5, colB: '#7a3fb0', colC: '#f4f1ea' }, 'Moiré'),
  // Contour
  P('contour', 'Contour', 'contour', {}, 'Contour'),
  P('contour-ember', 'Contour · ember', 'contour', { colA: '#0b0b0e', colB: '#c2502e', line: '#f6c453' }, 'Contour'),
  P('contour-dense', 'Contour · dense', 'contour', { freq: 8, bands: 14, colB: '#2a8f8f' }, 'Contour'),
  P('contour-wide', 'Contour · wide', 'contour', { freq: 3, bands: 5, colB: '#3a6ea5', line: '#f4f1ea' }, 'Contour'),
]
