// Simple (shape) loops — the base draw-fn modules + the picker presets. A preset
// names a base loop + a partial param override; the picker lists presets, the
// player resolves `{...loopDefaults(loop), ...preset.params}`. Add a base loop to
// SHAPE_LOOPS, add picker entries to SHAPE_PRESETS.

import morphCircle from './morphCircle.js'
import squareToCircle from './squareToCircle.js'
import barsWave from './barsWave.js'
import ringPulse from './ringPulse.js'
import lissajous from './lissajous.js'
import spiral from './spiral.js'
import starMorph from './starMorph.js'
import orbitDots from './orbitDots.js'
import waveGrid from './waveGrid.js'
import checkerPulse from './checkerPulse.js'
import arcSweep from './arcSweep.js'
import concentricArcs from './concentricArcs.js'
import rose from './rose.js'
import gridRotor from './gridRotor.js'
import blob from './blob.js'
import radialBars from './radialBars.js'

export const SHAPE_LOOPS = [
  morphCircle, squareToCircle, barsWave, ringPulse, lissajous, spiral,
  starMorph, orbitDots, waveGrid, checkerPulse, arcSweep, concentricArcs,
  rose, gridRotor, blob, radialBars,
]

const P = (id, label, loop, params = {}, sub) => ({ id, label, loop, params, sub })

export const SHAPE_PRESETS = [
  // Discs
  P('circle-morph', 'Circle morph', 'morph-circle', {}, 'Discs'),
  P('circle-warm', 'Circle morph · ember', 'morph-circle', { colA: '#f6c453', colB: '#7a1f12' }, 'Discs'),
  P('square-circle', 'Square ↔ circle', 'square-circle', {}, 'Discs'),
  P('star-classic', 'Star morph', 'star-morph', {}, 'Discs'),
  P('star-7', 'Heptagram', 'star-morph', { points: 7, colB: '#3a6ea5' }, 'Discs'),
  P('blob-soft', 'Blob', 'blob', {}, 'Discs'),
  P('blob-spiky', 'Blob · spiky', 'blob', { amp: 0.34, lobes: 6, colA: '#2a8f8f', colB: '#f4f1ea' }, 'Discs'),
  // Curves
  P('lissajous-32', 'Lissajous 3:2', 'lissajous', { a: 3, b: 2 }, 'Curves'),
  P('lissajous-54', 'Lissajous 5:4', 'lissajous', { a: 5, b: 4, dot: '#7fd1ff' }, 'Curves'),
  P('spiral-arch', 'Spiral', 'spiral', {}, 'Curves'),
  P('spiral-tight', 'Spiral · tight', 'spiral', { turns: 8, spin: 2, colB: '#c2502e' }, 'Curves'),
  P('spiral-filled', 'Spiral · pinwheel', 'spiral', { turns: 4, fillShape: true, fillAlpha: 0.5, colB: '#c2502e' }, 'Curves'),
  P('rose-5', 'Rose · 5', 'rose-curve', { k: 5 }, 'Curves'),
  P('rose-4', 'Rose · 4', 'rose-curve', { k: 4, colB: '#c2502e' }, 'Curves'),
  P('rose-filled', 'Rose · filled', 'rose-curve', { k: 6, fillShape: true, fillAlpha: 0.55, colB: '#c2502e' }, 'Curves'),
  P('lissajous-filled', 'Lissajous · woven', 'lissajous', { a: 3, b: 2, fillShape: true, fillAlpha: 0.4, fillRule: 'evenodd' }, 'Curves'),
  // Rings
  P('ring-pulse', 'Ring pulse', 'ring-pulse', {}, 'Rings'),
  P('ring-dense', 'Ring pulse · dense', 'ring-pulse', { rings: 28, weight: 2.5, colB: '#7fd1ff' }, 'Rings'),
  P('concentric', 'Concentric arcs', 'concentric-arcs', {}, 'Rings'),
  P('concentric-wide', 'Concentric · wide', 'concentric-arcs', { rings: 4, gap: 0.5, spin: 2, colB: '#3a6ea5' }, 'Rings'),
  P('concentric-bands', 'Concentric · bands', 'concentric-arcs', { ringFill: true, ringAlpha: 1, rings: 7, weight: 3, colA: '#f6c453', colB: '#7a1f12' }, 'Rings'),
  // Grids
  P('bars-wave', 'Bars wave', 'bars-wave', {}, 'Grids'),
  P('wave-grid', 'Wave grid', 'wave-grid', {}, 'Grids'),
  P('checker-pulse', 'Checker pulse', 'checker-pulse', {}, 'Grids'),
  P('grid-rotor', 'Grid rotor', 'grid-rotor', {}, 'Grids'),
  // Lines
  P('arc-sweep', 'Arc sweep', 'arc-sweep', {}, 'Lines'),
  P('arc-double', 'Arc sweep · double', 'arc-sweep', { turns: 2, sweep: '#f6c453' }, 'Lines'),
  P('arc-bands', 'Arc sweep · bands', 'arc-sweep', { ringFill: true, ringAlpha: 0.6, rings: 5 }, 'Lines'),
  P('radial-bars', 'Radial bars', 'radial-bars', {}, 'Lines'),
  P('radial-fan', 'Radial bars · fan', 'radial-bars', { count: 48, waves: 5, colB: '#f6c453' }, 'Lines'),
  // Particles
  P('orbit-dots', 'Orbit dots', 'orbit-dots', {}, 'Particles'),
  P('orbit-dense', 'Orbit dots · dense', 'orbit-dots', { rings: 9, dotsPer: 3, dotR: 5, colB: '#7fd1ff' }, 'Particles'),
  P('orbit-wide', 'Orbit dots · wide', 'orbit-dots', { rings: 4, dotsPer: 5, dotR: 11, colB: '#c2502e' }, 'Particles'),
  P('orbit-bare', 'Orbit dots · bare', 'orbit-dots', { showPath: false, dotR: 9, colB: '#f6c453' }, 'Particles'),
  P('orbit-discs', 'Orbit dots · discs', 'orbit-dots', { ringFill: true, ringAlpha: 0.5 }, 'Particles'),
  P('orbit-bands', 'Orbit dots · bands', 'orbit-dots', { ringFill: true, ringAlpha: 1, rings: 8, dotsPer: 2, colA: '#f6c453', colB: '#7a1f12' }, 'Particles'),
  P('orbit-radial', 'Orbit dots · radial', 'orbit-dots', { ringFill: true, ringAlpha: 0.7, fill: 'radial', rings: 6, colA: '#e8e4dc', colB: '#3a6ea5' }, 'Particles'),
  P('orbit-target', 'Orbit dots · target', 'orbit-dots', { ringFill: true, ringAlpha: 1, rings: 5, dotsPer: 4, dotR: 9, showPath: false, colA: '#e23829', colB: '#f4c020' }, 'Particles'),
]
