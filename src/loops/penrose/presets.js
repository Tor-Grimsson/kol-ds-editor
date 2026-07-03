// Penrose group — the labs generative-typography prototypes (kol-labs-single
// src/pages/penrose) as editor loops. Each foundation prototype becomes one
// loop via protoLoop (host.js) and one preset at its labs defaults, sub-
// grouped by the labs categories.js foundation mapping (Packing / Growth /
// Fields / Layered). The preset's mask substrate comes from the labs
// SUBSTRATE_POOL, indexed by prototype position — same per-preset shape
// assignment the labs page made.
//
// `live` per proto = the knobs its step reads via `params.x` (everything the
// labs authors wired for live tweaking); they act without re-init and are the
// safe bind targets. All other generation knobs are structural — see host.js.

import { protoLoop } from './host.js'
import { LIFE_FLOW_LOOPS, LIFE_FLOW_PRESETS } from './round2/presets-life-flow.js'
import { FORM_SIGNAL_LOOPS, FORM_SIGNAL_PRESETS } from './round2/presets-form-signal.js'

import { packingLloyd } from './protos/01-packing-lloyd.js'
import { diffgrow } from './protos/02-diffgrow.js'
import { spaceCol } from './protos/03-space-col.js'
import { boids } from './protos/04-boids.js'
import { frontPack } from './protos/05-front-pack.js'
import { dla } from './protos/06-dla.js'
import { flowField } from './protos/07-flow-field.js'
import { quadtree } from './protos/08-quadtree.js'
import { forceContainer } from './protos/09-force-container.js'
import { reactionDiff } from './protos/10-reaction-diffusion.js'
import { attractor } from './protos/11-attractor.js'
import { lSystem } from './protos/12-l-system.js'
import { layered } from './protos/13-layered.js'
import { layeredErase } from './protos/14-layered-erase.js'
import { triggered } from './protos/15-triggered.js'

/* The 15 foundation protos in labs PROTOTYPES order (position drives the
 * substrate assignment below). */
const FOUNDATIONS = [
  { proto: packingLloyd, live: ['spokes', 'bounce', 'loop'] },
  { proto: diffgrow },
  { proto: spaceCol },
  { proto: boids },
  { proto: frontPack },
  { proto: dla },
  { proto: flowField },
  { proto: quadtree },
  { proto: forceContainer, live: ['margin'] },
  { proto: reactionDiff },
  { proto: attractor, live: ['scale'] },
  { proto: lSystem },
  { proto: layered },
  { proto: layeredErase },
  { proto: triggered },
]

/* labs categories.js FOUNDATION_SUB → display label. */
const SUB = {
  '01-packing-lloyd': 'Packing', '05-front-pack': 'Packing', '08-quadtree': 'Packing', '09-force-container': 'Packing',
  '02-diffgrow': 'Growth', '03-space-col': 'Growth', '06-dla': 'Growth', '12-l-system': 'Growth',
  '04-boids': 'Fields', '07-flow-field': 'Fields', '10-reaction-diffusion': 'Fields', '11-attractor': 'Fields',
  '13-layered': 'Layered', '14-layered-erase': 'Layered', '15-triggered': 'Layered',
}
const SUB_ORDER = ['Packing', 'Growth', 'Fields', 'Layered']

/* labs PenrosePage SUBSTRATE_POOL — per-preset mask assignment by position. */
const SUBSTRATE_POOL = [
  { shape: 'circle' }, { shape: 'triangle' }, { shape: 'square' }, { shape: 'hexagon' },
  { shape: 'star' }, { shape: 'blob' }, { shape: 'ring' },
  { shape: 'glyph', glyph: 'A' }, { shape: 'glyph', glyph: 'O' },
  { shape: 'glyph', glyph: 'S' }, { shape: 'glyph', glyph: 'G' },
]

const FOUNDATION_LOOPS = FOUNDATIONS.map(({ proto, live }) => protoLoop(proto, { live }))

const FOUNDATION_PRESETS = FOUNDATIONS
  .map(({ proto }, i) => ({
    id: `pen-${proto.id}`,
    label: proto.name,
    loop: `penrose-${proto.id}`,
    sub: SUB[proto.id] ?? 'Packing',
    params: { ...SUBSTRATE_POOL[i % SUBSTRATE_POOL.length] },
  }))
  .sort((a, b) => SUB_ORDER.indexOf(a.sub) - SUB_ORDER.indexOf(b.sub))

/* Round2 ports plug in HERE: import each round2 preset file above and spread
 * its loops/presets into the two exports below (one import + one spread per
 * file — the registry needs no further edits). */
export const PENROSE_LOOPS = [...FOUNDATION_LOOPS, ...LIFE_FLOW_LOOPS, ...FORM_SIGNAL_LOOPS]
export const PENROSE_PRESETS = [...FOUNDATION_PRESETS, ...LIFE_FLOW_PRESETS, ...FORM_SIGNAL_PRESETS]
