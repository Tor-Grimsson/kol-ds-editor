// Penrose round2 — Reaction & Life + Flow & Dynamics (20 of the 40 round2
// territory prototypes; the Form/Pattern half lives in its sibling preset
// file). Same contract as ../presets.js: each proto → one protoLoop def +
// one preset at labs defaults. `live` per proto = the keys its step reads
// via `params.x`/num() INSIDE the wrapLoop closure (act without re-init,
// safe bind targets); init-destructured keys stay structural.
//
// Substrates follow the labs PenrosePage SUBSTRATE_POOL assignment: pool of
// 11 indexed by the proto's position in the labs PROTOTYPES array (15
// foundations first, then ROUND2_PROTOTYPES order) — noted per entry.
//
// Subs follow labs categories.js: act-* files live here (port batching) but
// register under Pattern & Signal; phys-* ships in the sibling file under
// Flow & Dynamics. File location ≠ sub — the picker groups by sub.

import { protoLoop } from '../host.js'

import { r2_rd_01_fhn } from './rd-01-fhn.js'
import { r2_rd_04_seashell } from './rd-04-seashell.js'
import { r2_lsys_01_tropism } from './lsys-01-tropism.js'
import { r2_lsys_04_phyllotaxis } from './lsys-04-phyllotaxis.js'
import { r2_ca_01_lenia } from './ca-01-lenia.js'
import { r2_ca_02_smoothlife } from './ca-02-smoothlife.js'
import { r2_soc_01_btw } from './soc-01-btw.js'
import { r2_soc_03_forestfire } from './soc-03-forestfire.js'
import { r2_nca_01_munca } from './nca-01-munca.js'
import { r2_nca_03_dynca } from './nca-03-dynca.js'
import { r2_fluid_03_stam } from './fluid-03-stam.js'
import { r2_fluid_05_sph } from './fluid-05-sph.js'
import { r2_act_01_vicsek } from './act-01-vicsek.js'
import { r2_act_03_mips } from './act-03-mips.js'
import { r2_attr_02_aizawa } from './attr-02-aizawa.js'
import { r2_attr_04_thomas } from './attr-04-thomas.js'
import { r2_wave_02_chladni } from './wave-02-chladni.js'
import { r2_wave_04_kuramoto_sivashinsky } from './wave-04-kuramoto-sivashinsky.js'
import { r2_nbody_01_fig8 } from './nbody-01-fig8.js'
import { r2_nbody_05_plummer } from './nbody-05-plummer.js'

const REACT = 'Reaction & Life'
const FLOW = 'Flow & Dynamics'
const SIGNAL = 'Pattern & Signal'

/* { proto, live, sub, mask } — labs nav order within each sub; mask = the
 * labs SUBSTRATE_POOL slot for that proto's PROTOTYPES position (in comment). */
const PROTOS = [
  /* ── Reaction & Life ── */
  { proto: r2_rd_01_fhn, sub: REACT, mask: { shape: 'ring' } },                                              // idx 17
  { proto: r2_rd_04_seashell, sub: REACT, mask: { shape: 'glyph', glyph: 'A' } },                            // idx 18
  { proto: r2_lsys_01_tropism, sub: REACT, mask: { shape: 'glyph', glyph: 'O' },                             // idx 19
    live: ['angle', 'tropism', 'growRate', 'maxDepth', 'taper', 'showLoad'] },
  { proto: r2_lsys_04_phyllotaxis, sub: REACT, mask: { shape: 'glyph', glyph: 'S' },                         // idx 20
    live: ['spawnRate', 'axisStep', 'armScale', 'waveAmp', 'showAxis'] },
  { proto: r2_ca_01_lenia, sub: REACT, mask: { shape: 'triangle' } },                                        // idx 23
  { proto: r2_ca_02_smoothlife, sub: REACT, mask: { shape: 'square' } },                                     // idx 24
  { proto: r2_soc_01_btw, sub: REACT, mask: { shape: 'glyph', glyph: 'O' } },                                // idx 41
  { proto: r2_soc_03_forestfire, sub: REACT, mask: { shape: 'glyph', glyph: 'S' } },                         // idx 42
  { proto: r2_nca_01_munca, sub: REACT, mask: { shape: 'glyph', glyph: 'S' } },                              // idx 53
  { proto: r2_nca_03_dynca, sub: REACT, mask: { shape: 'glyph', glyph: 'G' },                                // idx 54
    live: ['angle', 'speed', 'rate', 'bright'] },
  /* ── Flow & Dynamics ── */
  { proto: r2_fluid_03_stam, sub: FLOW, mask: { shape: 'star' } },                                           // idx 15
  { proto: r2_fluid_05_sph, sub: FLOW, mask: { shape: 'blob' } },                                            // idx 16
  { proto: r2_act_01_vicsek, sub: SIGNAL, mask: { shape: 'hexagon' },                                        // idx 25
    live: ['N', 'v0', 'noise', 'R', 'trail'] },
  { proto: r2_act_03_mips, sub: SIGNAL, mask: { shape: 'star' },                                             // idx 26
    live: ['N', 'v0', 'Dr', 'rhoM', 'rep'] },
  { proto: r2_attr_02_aizawa, sub: FLOW, mask: { shape: 'blob' },                                            // idx 27
    live: ['a', 'b', 'c', 'dt', 'tail'] },
  { proto: r2_attr_04_thomas, sub: FLOW, mask: { shape: 'ring' },                                            // idx 28
    live: ['b', 'dt', 'trails', 'tail', 'spin'] },
  { proto: r2_wave_02_chladni, sub: FLOW, mask: { shape: 'ring' },                                           // idx 39
    live: ['modeA', 'modeB', 'speed', 'nodal'] },
  { proto: r2_wave_04_kuramoto_sivashinsky, sub: FLOW, mask: { shape: 'glyph', glyph: 'A' },                 // idx 40
    live: ['dt', 'scale', 'steps'] },
  { proto: r2_nbody_01_fig8, sub: FLOW, mask: { shape: 'triangle' },                                         // idx 45
    live: ['G', 'dt', 'substeps', 'trail'] },
  { proto: r2_nbody_05_plummer, sub: FLOW, mask: { shape: 'square' },                                        // idx 46
    live: ['N', 'G', 'dt', 'eps', 'wall', 'trail'] },
]

export const LIFE_FLOW_LOOPS = PROTOS.map(({ proto, live }) => protoLoop(proto, { live }))

export const LIFE_FLOW_PRESETS = PROTOS.map(({ proto, sub, mask }) => ({
  id: `pen-${proto.id}`,
  label: proto.name,
  loop: `penrose-${proto.id}`,
  sub,
  params: { ...mask },
}))
