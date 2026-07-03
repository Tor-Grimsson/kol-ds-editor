// Penrose round2 — Form & Geometry + Pattern & Signal (20 of the 40 round2
// territory prototypes; the Life/Flow half lives in presets-life-flow.js).
// Same contract as ../presets.js: each proto → one protoLoop def + one preset
// at labs defaults. `live` per proto = the keys its step reads via
// `params.x`/num() INSIDE the wrapLoop closure (act without re-init, safe
// bind targets); init-destructured keys stay structural.
//
// Substrates follow the labs PenrosePage SUBSTRATE_POOL assignment: pool of
// 11 indexed by the proto's position in the labs PROTOTYPES array (15
// foundations first, then ROUND2_PROTOTYPES order) — noted per entry.
//
// Subs follow labs categories.js: phys-* files live here (port batching) but
// register under Flow & Dynamics; act-* ships in the sibling file under
// Pattern & Signal. File location ≠ sub — the picker groups by sub.

import { protoLoop } from '../host.js'

import { r2_hyp_03_droste } from './hyp-03-droste.js'
import { r2_hyp_05_apollonian } from './hyp-05-apollonian.js'
import { r2_geom_02_alpha } from './geom-02-alpha.js'
import { r2_geom_03_apollonius } from './geom-03-apollonius.js'
import { r2_curve_01_csf } from './curve-01-csf.js'
import { r2_curve_03_repulsive } from './curve-03-repulsive.js'
import { r2_topo_02_hopf } from './topo-02-hopf.js'
import { r2_topo_03_clifford } from './topo-03-clifford.js'
import { r2_tile_02_hat } from './tile-02-hat.js'
import { r2_tile_05_penrose } from './tile-05-penrose.js'
import { r2_phys_02_chemotaxis } from './phys-02-chemotaxis.js'
import { r2_phys_03_multispecies } from './phys-03-multispecies.js'
import { r2_frac_01_flame } from './frac-01-flame.js'
import { r2_frac_02_buddhabrot } from './frac-02-buddhabrot.js'
import { r2_stoch_01_wilson } from './stoch-01-wilson.js'
import { r2_stoch_04_eden } from './stoch-04-eden.js'
import { r2_spec_01_harmonograph } from './spec-01-harmonograph.js'
import { r2_spec_04_maurer_rose } from './spec-04-maurer-rose.js'
import { r2_net_01_ba } from './net-01-ba.js'
import { r2_net_04_mst } from './net-04-mst.js'

const FORM = 'Form & Geometry'
const SIGNAL = 'Pattern & Signal'
const FLOW = 'Flow & Dynamics'

/* { proto, live, sub, mask } — labs nav order within each sub; mask = the
 * labs SUBSTRATE_POOL slot for that proto's PROTOTYPES position (in comment). */
const PROTOS = [
  /* ── Form & Geometry ── */
  { proto: r2_hyp_03_droste, sub: FORM, mask: { shape: 'glyph', glyph: 'S' },                                 // idx 31
    live: ['zoom', 'scale', 'twist', 'bands', 'cx', 'cy'] },
  { proto: r2_hyp_05_apollonian, sub: FORM, mask: { shape: 'glyph', glyph: 'G' },                             // idx 32
    live: ['depth', 'breathe', 'rot', 'stroke', 'glow'] },
  { proto: r2_geom_02_alpha, sub: FORM, mask: { shape: 'circle' },                                            // idx 33
    live: ['speed', 'jitter', 'reverse'] },
  { proto: r2_geom_03_apollonius, sub: FORM, mask: { shape: 'triangle' },                                     // idx 34
    live: ['waveSpd', 'wOffset'] },
  { proto: r2_curve_01_csf, sub: FORM, mask: { shape: 'square' } },                                           // idx 35
  { proto: r2_curve_03_repulsive, sub: FORM, mask: { shape: 'hexagon' } },                                    // idx 36
  { proto: r2_topo_02_hopf, sub: FORM, mask: { shape: 'glyph', glyph: 'G' },                                  // idx 43
    live: ['fibers', 'spin', 'pts', 'cam', 'alpha'] },
  { proto: r2_topo_03_clifford, sub: FORM, mask: { shape: 'circle' },                                         // idx 44
    live: ['grid', 'spin1', 'spin2', 'cam', 'alpha'] },
  { proto: r2_tile_02_hat, sub: FORM, mask: { shape: 'blob' },                                                // idx 49
    live: ['depth', 'scale', 'pulse', 'outlines'] },
  { proto: r2_tile_05_penrose, sub: FORM, mask: { shape: 'ring' },                                            // idx 50
    live: ['depth', 'tileScale', 'spin', 'fillOpacity'] },
  /* ── Pattern & Signal ── */
  { proto: r2_phys_02_chemotaxis, sub: FLOW, mask: { shape: 'glyph', glyph: 'G' } },                          // idx 21
  { proto: r2_phys_03_multispecies, sub: FLOW, mask: { shape: 'circle' } },                                   // idx 22
  { proto: r2_frac_01_flame, sub: SIGNAL, mask: { shape: 'glyph', glyph: 'A' },                               // idx 29
    live: ['iters', 'drift', 'gamma', 'palette'] },
  { proto: r2_frac_02_buddhabrot, sub: SIGNAL, mask: { shape: 'glyph', glyph: 'O' },                          // idx 30
    live: ['samples', 'maxIter', 'decay', 'nebula'] },
  { proto: r2_stoch_01_wilson, sub: SIGNAL, mask: { shape: 'star' },                                          // idx 37
    live: ['stepsPerFrame', 'walkerBright'] },
  { proto: r2_stoch_04_eden, sub: SIGNAL, mask: { shape: 'blob' },                                            // idx 38
    live: ['stepsPerFrame', 'variantB'] },
  { proto: r2_spec_01_harmonograph, sub: SIGNAL, mask: { shape: 'hexagon' },                                  // idx 47
    live: ['f1', 'f2', 'phi', 'damp', 'trail'] },
  { proto: r2_spec_04_maurer_rose, sub: SIGNAL, mask: { shape: 'star' },                                      // idx 48
    live: ['n', 'd', 'drift', 'alpha'] },
  { proto: r2_net_01_ba, sub: SIGNAL, mask: { shape: 'glyph', glyph: 'A' },                                   // idx 51
    live: ['N', 'm', 'addPerSec', 'nodeSize'] },
  { proto: r2_net_04_mst, sub: SIGNAL, mask: { shape: 'glyph', glyph: 'O' },                                  // idx 52
    live: ['N', 'edgesPerSec', 'depthBias'] },
]

export const FORM_SIGNAL_LOOPS = PROTOS.map(({ proto, live }) => protoLoop(proto, { live }))

export const FORM_SIGNAL_PRESETS = PROTOS.map(({ proto, sub, mask }) => ({
  id: `pen-${proto.id}`,
  label: proto.name,
  loop: `penrose-${proto.id}`,
  sub,
  params: { ...mask },
}))
