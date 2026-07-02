// Soft Forms catalog — scenes = arrangements of SDF forms in one frame, rendered
// by the shared matcap engine. 3 categories × 4 scenes; nav + routes derive from
// here so they can't drift (mirrors Gradients / Loops / Scanlines).
//
// A form = { t, x, y, sx, sy, rot, hue }: t = teardrop|pill|dome|orb|super,
// (x,y) centre in clip space (y ∈ [-1,1]), (sx,sy) radius, rot in degrees,
// hue = per-form palette offset (so stacked forms read as distinct colours).

export const SOFTFORM_CATEGORIES = [
  { id: 'stack', label: 'Stack' },     // vertical mirror stacks — the Apple look
  { id: 'solo', label: 'Solo' },       // a single hero form
  { id: 'cluster', label: 'Cluster' }, // many forms / drifting
]

const CAT_IDX = { stack: 0, solo: 1, cluster: 2 }
export const catIndex = (id) => CAT_IDX[id] ?? 0

// Page › Category › Preset: CATEGORIES (Stack/Solo/Cluster) list in the sidebar;
// the SCENES inside are the PRESETS picked in the rail. First category owns /softforms.
export const catRoute = (id) => (id === SOFTFORM_CATEGORIES[0].id ? '/softforms' : `/softforms/${id}`)
export const categoryById = (id) => SOFTFORM_CATEGORIES.find((c) => c.id === id) || SOFTFORM_CATEGORIES[0]

export const SCENES = [
  // ── Stack ──────────────────────────────────────────────────────────────
  { id: 'trinity', cat: 'stack', label: 'Trinity', // Image #3
    defaults: { palette: 'spectrum', spectral: true, sweep: 18, irid: 1.05, hue: 0.0 },
    forms: [
      { t: 'teardrop', x: 0, y: 0.95, sx: 0.66, sy: 0.84, rot: 180, hue: 0.0 },
      { t: 'pill', x: 0, y: 0.02, sx: 0.98, sy: 0.54, rot: 0, hue: 0.34 },
      { t: 'teardrop', x: 0, y: -0.95, sx: 0.66, sy: 0.84, rot: 0, hue: 0.62 },
    ] },
  { id: 'hourglass', cat: 'stack', label: 'Hourglass',
    defaults: { palette: 'iris', spectral: false, sweep: 12, irid: 1.1, hue: 0.05 },
    forms: [
      { t: 'teardrop', x: 0, y: 0.7, sx: 0.72, sy: 0.9, rot: 180, hue: 0.0 },
      { t: 'teardrop', x: 0, y: -0.7, sx: 0.72, sy: 0.9, rot: 0, hue: 0.5 },
    ] },
  { id: 'pair', cat: 'stack', label: 'Pair',
    defaults: { palette: 'aqua', spectral: false, sweep: 30, irid: 1.0, hue: 0.1 },
    forms: [
      { t: 'pill', x: 0, y: 0.5, sx: 0.9, sy: 0.46, rot: 0, hue: 0.0 },
      { t: 'pill', x: 0, y: -0.5, sx: 0.9, sy: 0.46, rot: 0, hue: 0.45 },
    ] },
  { id: 'kiss', cat: 'stack', label: 'Kiss', // Image #4
    defaults: { palette: 'spectrum', spectral: true, sweep: 32, irid: 1.0, hue: 0.0 },
    forms: [
      { t: 'teardrop', x: 0.04, y: 0.6, sx: 0.92, sy: 1.0, rot: 158, hue: 0.0 },
      { t: 'dome', x: 0, y: -0.78, sx: 1.1, sy: 0.74, rot: 0, hue: 0.34 },
    ] },

  // ── Solo ───────────────────────────────────────────────────────────────
  { id: 'teardrop', cat: 'solo', label: 'Teardrop',
    defaults: { palette: 'spectrum', spectral: true, sweep: 20, irid: 1.1, hue: 0.0 },
    forms: [{ t: 'teardrop', x: 0, y: 0, sx: 0.8, sy: 1.02, rot: 0, hue: 0.0 }] },
  { id: 'orb', cat: 'solo', label: 'Orb',
    defaults: { palette: 'spectrum', spectral: true, sweep: 24, irid: 1.15, hue: 0.4 },
    forms: [{ t: 'orb', x: 0, y: 0, sx: 0.94, sy: 0.94, rot: 0, hue: 0.0 }] },
  { id: 'pill', cat: 'solo', label: 'Pill',
    defaults: { palette: 'iris', spectral: false, sweep: 28, irid: 1.0, hue: 0.12 },
    forms: [{ t: 'pill', x: 0, y: 0, sx: 1.02, sy: 0.62, rot: 0, hue: 0.0 }] },
  { id: 'lozenge', cat: 'solo', label: 'Lozenge',
    defaults: { palette: 'candy', spectral: false, sweep: 36, irid: 1.05, hue: 0.55 },
    forms: [{ t: 'super', x: 0, y: 0, sx: 0.96, sy: 0.72, rot: 0, hue: 0.0 }] },

  // ── Cluster ────────────────────────────────────────────────────────────
  { id: 'lava', cat: 'cluster', label: 'Lava',
    defaults: { palette: 'magma', spectral: false, sweep: 20, irid: 1.0, hue: 0.05, motion: 0.5, bulge: 0.7 },
    forms: [
      { t: 'dome', x: -0.45, y: 0.5, sx: 0.5, sy: 0.5, rot: 0, hue: 0.0 },
      { t: 'dome', x: 0.4, y: 0.65, sx: 0.42, sy: 0.42, rot: 0, hue: 0.2 },
      { t: 'dome', x: 0.0, y: -0.1, sx: 0.6, sy: 0.6, rot: 0, hue: 0.4 },
      { t: 'dome', x: -0.35, y: -0.6, sx: 0.46, sy: 0.46, rot: 0, hue: 0.6 },
      { t: 'dome', x: 0.45, y: -0.5, sx: 0.4, sy: 0.4, rot: 0, hue: 0.8 },
    ] },
  { id: 'bloom', cat: 'cluster', label: 'Bloom',
    defaults: { palette: 'spectrum', spectral: true, sweep: 0, irid: 1.2, hue: 0.0, motion: 0.25 },
    forms: [
      { t: 'teardrop', x: 0, y: 0.62, sx: 0.4, sy: 0.66, rot: 180, hue: 0.0 },
      { t: 'teardrop', x: 0.6, y: 0.2, sx: 0.4, sy: 0.66, rot: 250, hue: 0.2 },
      { t: 'teardrop', x: 0.38, y: -0.55, sx: 0.4, sy: 0.66, rot: 320, hue: 0.4 },
      { t: 'teardrop', x: -0.38, y: -0.55, sx: 0.4, sy: 0.66, rot: 40, hue: 0.6 },
      { t: 'teardrop', x: -0.6, y: 0.2, sx: 0.4, sy: 0.66, rot: 110, hue: 0.8 },
    ] },
  { id: 'twins', cat: 'cluster', label: 'Twins',
    defaults: { palette: 'aqua', spectral: true, sweep: 40, irid: 1.0, hue: 0.0, motion: 0.3 },
    forms: [
      { t: 'orb', x: -0.34, y: 0.12, sx: 0.7, sy: 0.7, rot: 0, hue: 0.0 },
      { t: 'orb', x: 0.34, y: -0.12, sx: 0.7, sy: 0.7, rot: 0, hue: 0.5 },
    ] },
  { id: 'eclipse', cat: 'cluster', label: 'Eclipse',
    defaults: { palette: 'noir', spectral: true, sweep: 50, irid: 0.7, hue: 0.0, rim: 1.1, motion: 0.2 },
    forms: [
      { t: 'orb', x: -0.18, y: 0.08, sx: 0.92, sy: 0.92, rot: 0, hue: 0.0 },
      { t: 'orb', x: 0.5, y: -0.2, sx: 0.55, sy: 0.55, rot: 0, hue: 0.45 },
    ] },
]

export const SCENE_BY_ID = Object.fromEntries(SCENES.map((s) => [s.id, s]))
export const DEFAULT_SCENE = 'trinity'

// The scenes (presets) inside a category, in registry order.
export const presetsForCat = (cat) => SCENES.filter((s) => s.cat === cat)

// Palette / iridescence looks applied on top of any scene.
export const LOOK_PRESETS = [
  { id: 'spectrum', label: 'Spectrum', p: { palette: 'spectrum', spectral: true, hue: 0, irid: 1.1 } },
  { id: 'iris', label: 'Iris', p: { palette: 'iris', spectral: false, hue: 0.1, irid: 1.05 } },
  { id: 'aqua', label: 'Aqua', p: { palette: 'aqua', spectral: false, hue: 0.5, irid: 1.0 } },
  { id: 'magma', label: 'Magma', p: { palette: 'magma', spectral: false, hue: 0.05, irid: 0.95 } },
  { id: 'candy', label: 'Candy', p: { palette: 'candy', spectral: false, hue: 0.8, irid: 1.15 } },
  { id: 'noir', label: 'Noir', p: { palette: 'spectrum', spectral: true, hue: 0, irid: 0.6, rim: 1.0 } },
]

// Baseline shading params; a scene's `defaults` override these.
export const BASE_PARAMS = {
  hue: 0, irid: 1.0, sweep: 20, sheen: 0.35, gloss: 32,
  rim: 0.7, rimPow: 2.6, rimShift: 0.12, sss: 0.25,
  bulge: 0.55, relief: 1.0, motion: 0.0, grain: 0.02,
  spectral: true, palette: 'spectrum', backdrop: 'black',
}

// Params that animate (run through resolveDeep each frame).
export const NUMERIC_KEYS = ['hue', 'irid', 'sweep', 'sheen', 'gloss', 'rim', 'rimPow', 'sss', 'bulge', 'relief', 'motion', 'grain']

// Slider specs for the rail.
export const CTRL_SPEC = {
  sweep: { label: 'Sweep', min: 0, max: 360, step: 1 },
  irid: { label: 'Iridescence', min: 0, max: 2.5, step: 0.05 },
  hue: { label: 'Hue', min: 0, max: 1, step: 0.01 },
  sheen: { label: 'Sheen', min: 0, max: 1.5, step: 0.02 },
  gloss: { label: 'Gloss', min: 4, max: 90, step: 1 },
  rim: { label: 'Rim', min: 0, max: 2, step: 0.05 },
  rimPow: { label: 'Rim focus', min: 1, max: 6, step: 0.1 },
  rimShift: { label: 'Rim shift', min: 0, max: 0.5, step: 0.01 },
  sss: { label: 'Subsurface', min: 0, max: 1, step: 0.02 },
  bulge: { label: 'Bulge', min: 0.2, max: 1.2, step: 0.02 },
  relief: { label: 'Relief', min: 0.2, max: 2.5, step: 0.05 },
  motion: { label: 'Motion', min: 0, max: 1.5, step: 0.05 },
  grain: { label: 'Grain', min: 0, max: 0.12, step: 0.005 },
}
