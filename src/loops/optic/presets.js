// Optic loops — the three canvas2d op-art engines ported from kol-labs-single
// optic/ (halftone dot-matrix, moiré interference, Gray-Scott reaction-diffusion)
// + the picker presets. A preset names a base loop + a partial param override.
// The labs' named PALETTES drive the colour variants: halftone/reaction keep
// their multi-stop ramps as palette selects, moiré's duotone pairs land directly
// on colA/colB. (optic/gradient-field is three.js — it ships with the GL wave.)

import halftone from './halftone.js'
import moire, { MOIRE_PALETTES } from './moire.js'
import reaction from './reaction.js'

export const OPTIC_LOOPS = [halftone, moire, reaction]

const P = (id, label, loop, params = {}, sub) => ({ id, label, loop, params, sub })

// Moiré duotone pairs, from the labs MOIRE_PALETTES.
const pal = (v) => {
  const cols = (MOIRE_PALETTES.find((x) => x.value === v) || MOIRE_PALETTES[0]).cols
  return { colA: cols[0], colB: cols[1] }
}

export const OPTIC_PRESETS = [
  // Halftone
  P('optic-half-drekker', 'Halftone · Drekker', 'optic-halftone', {}, 'Halftone'),
  P('optic-half-sunset', 'Halftone · sunset', 'optic-halftone', { field: 'waves', palette: 'sunset', bg: '#0d0221' }, 'Halftone'),
  P('optic-half-ice', 'Halftone · ice', 'optic-halftone', { field: 'noise', palette: 'ice', layout: 'square', bg: '#011627' }, 'Halftone'),
  P('optic-half-mono', 'Halftone · mono', 'optic-halftone', { field: 'linear', palette: 'mono', shape: 'square', bg: '#000000' }, 'Halftone'),
  P('optic-half-phyllo', 'Halftone · phyllotaxis', 'optic-halftone', { layout: 'phyllotaxis', density: 60, dotScale: 1.4 }, 'Halftone'),
  P('optic-half-rings', 'Halftone · rings', 'optic-halftone', { shape: 'ring', field: 'waves', palette: 'ice', bg: '#011627' }, 'Halftone'),
  P('optic-half-dense', 'Halftone · dense', 'optic-halftone', { density: 64, dotScale: 0.85, palette: 'sunset', bg: '#0d0221' }, 'Halftone'),
  P('optic-half-spin', 'Halftone · spin', 'optic-halftone', { spin: 1, field: 'radial', layout: 'square' }, 'Halftone'),
  // Moiré
  P('optic-moire-xor', 'Moiré · interference', 'optic-moire', {}, 'Moiré'),
  P('optic-moire-beat', 'Moiré · concentric', 'optic-moire', { g1Type: 'concentric', g2Type: 'concentric', g1Freq: 10, g2Freq: 11, g2Angle: 0 }, 'Moiré'),
  P('optic-moire-fan', 'Moiré · radial', 'optic-moire', { g1Type: 'radial', g2Type: 'radial', g1Freq: 12, g2Freq: 13 }, 'Moiré'),
  P('optic-moire-blood', 'Moiré · blood', 'optic-moire', { ...pal('blood'), g2Angle: 4, hardness: 0.5 }, 'Moiré'),
  P('optic-moire-cyan', 'Moiré · cyan rings', 'optic-moire', { ...pal('cyan'), g1Type: 'concentric', g2Type: 'lines', g1Freq: 9 }, 'Moiré'),
  P('optic-moire-gold', 'Moiré · gold', 'optic-moire', { ...pal('gold'), g1Type: 'radial', g2Type: 'concentric', combine: 'multiply', g2Freq: 8 }, 'Moiré'),
  P('optic-moire-soft', 'Moiré · soft', 'optic-moire', { combine: 'screen', hardness: 0, g2Angle: 12 }, 'Moiré'),
  // Reaction (feed/kill pairs from the labs RD_PRESETS)
  P('optic-rd-mitosis', 'Reaction · mitosis', 'optic-reaction', {}, 'Reaction'),
  P('optic-rd-maze', 'Reaction · maze', 'optic-reaction', { feed: 0.029, kill: 0.057, palette: 'ink', seed: 'stripe' }, 'Reaction'),
  P('optic-rd-spots', 'Reaction · spots', 'optic-reaction', { feed: 0.035, kill: 0.065, palette: 'violet', seed: 'grid' }, 'Reaction'),
  P('optic-rd-coral', 'Reaction · coral', 'optic-reaction', { feed: 0.0545, kill: 0.062, palette: 'jade', seed: 'center' }, 'Reaction'),
  P('optic-rd-worms', 'Reaction · worms', 'optic-reaction', { feed: 0.046, kill: 0.063, palette: 'lava' }, 'Reaction'),
  P('optic-rd-ink', 'Reaction · ink coral', 'optic-reaction', { feed: 0.0545, kill: 0.062, palette: 'ink', seed: 'center' }, 'Reaction'),
  P('optic-rd-violet', 'Reaction · violet', 'optic-reaction', { palette: 'violet', seed: 'grid', gain: 4 }, 'Reaction'),
]
