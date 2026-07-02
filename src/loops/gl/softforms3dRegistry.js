// Soft Forms 3D scene catalog.
//
// METABALL SPACING RULE:
//   For radius r, the merge neck appears at ~d = 2√2 · r ≈ 2.83r between two
//   equal balls. For a VISIBLE neck (not fully fused, not separated), aim for
//   d ≈ 1.4–1.9r_sum. With motion=0.7 and shader amplitude 0.35, each ball
//   moves ±0.35 per axis, so relative separation swings ±0.7+. Place base
//   positions at the "just necking" distance so the animation cycle goes:
//     min-dist → deeply merged blob → base → neck → max-dist → separated
//   That full cycle is what makes metaballs visually unmistakable.

export const CATEGORIES_3D = [
  { id: 'forms', label: 'Forms' },
  { id: 'meta',  label: 'Metaballs' },
]

export const SCENES_3D = [

  // ── Forms — discrete 3D SDF shapes, orbit to read the depth ──────────

  { id: 'trio', cat: 'forms', label: 'Trio',
    defaults: { palette: 'spectrum', spectral: true, sweep: 22, irid: 1.15,
                motion: 0.25, rim: 1.0, sss: 0.3, sheen: 0.45, metaball: false },
    forms: [
      { t: 'teardrop', x:  0,     y:  0.7,  z:  0,    sx: 0.58, sy: 0.78, sz: 0.58, rot:   0, hue: 0.0  },
      { t: 'sphere',   x: -0.52,  y: -0.38, z:  0.14, sx: 0.52, sy: 0.52, sz: 0.52, rot:   0, hue: 0.33 },
      { t: 'sphere',   x:  0.52,  y: -0.38, z: -0.14, sx: 0.52, sy: 0.52, sz: 0.52, rot:   0, hue: 0.66 },
    ] },

  { id: 'stack3', cat: 'forms', label: 'Stack',
    defaults: { palette: 'iris', spectral: false, sweep: 12, irid: 1.05,
                motion: 0.15, rim: 0.8, sss: 0.25, sheen: 0.38, metaball: false },
    forms: [
      { t: 'teardrop', x: 0, y:  0.9,  z: 0, sx: 0.6,  sy: 0.75, sz: 0.6,  rot:   0, hue: 0.0 },
      { t: 'capsule',  x: 0, y:  0.0,  z: 0, sx: 0.52, sy: 0.52, sz: 0.52, rot:   0, hue: 0.4 },
      { t: 'teardrop', x: 0, y: -0.9,  z: 0, sx: 0.6,  sy: 0.75, sz: 0.6,  rot: 180, hue: 0.72 },
    ] },

  { id: 'gem', cat: 'forms', label: 'Gem',
    defaults: { palette: 'candy', spectral: false, sweep: 38, irid: 1.3,
                motion: 0.2, rim: 1.2, sss: 0.15, sheen: 0.6, gloss: 60, metaball: false },
    forms: [
      { t: 'lozenge', x: 0, y: 0, z: 0, sx: 0.9, sy: 0.68, sz: 0.9, rot: 20, hue: 0.0 },
    ] },

  // ── Metaballs — potential-field isosurface; forms merge organically ───
  //
  // Base positions are at the "neck distance" for their radii.
  // motion=0.7–0.9 with shader amp 0.35 → ±0.245 per axis → relative
  // swing of ~0.5–0.7 units → full separated→merged animation cycle.

  { id: 'binary', cat: 'meta', label: 'Binary',
    // Two large balls that slowly orbit and merge — clearest neck demo.
    // r=0.82 → neck at d≈2.3. Base d≈1.6 → already necking; animation
    // takes them from d≈1.0 (deep merge) to d≈2.2 (barely touching).
    defaults: { palette: 'aqua', spectral: false, irid: 1.1, motion: 0.8,
                sweep: 24, rim: 0.9, sss: 0.4, sheen: 0.4, metaball: true },
    forms: [
      { t: 'sphere', x: -0.8, y:  0.1, z:  0.1, sx: 0.82, sy: 0.82, sz: 0.82, rot: 0, hue: 0.0  },
      { t: 'sphere', x:  0.8, y: -0.1, z: -0.1, sx: 0.82, sy: 0.82, sz: 0.82, rot: 0, hue: 0.48 },
    ] },

  { id: 'lava3', cat: 'meta', label: 'Lava',
    // Five balls of varying size. Inner cluster always merged; outer two
    // drift in and out. motion=0.9 for maximum organic chaos.
    defaults: { palette: 'magma', spectral: false, irid: 0.9, motion: 0.9,
                sweep: 16, rim: 0.65, sss: 0.5, sheen: 0.35, metaball: true },
    forms: [
      { t: 'sphere', x:  0,     y:  0.1,  z:  0,    sx: 0.88, sy: 0.88, sz: 0.88, rot: 0, hue: 0.0  },
      { t: 'sphere', x: -0.7,   y:  0.55, z:  0.15, sx: 0.62, sy: 0.62, sz: 0.62, rot: 0, hue: 0.18 },
      { t: 'sphere', x:  0.65,  y:  0.5,  z: -0.1,  sx: 0.58, sy: 0.58, sz: 0.58, rot: 0, hue: 0.38 },
      { t: 'sphere', x: -0.55,  y: -0.6,  z:  0.1,  sx: 0.52, sy: 0.52, sz: 0.52, rot: 0, hue: 0.58 },
      { t: 'sphere', x:  0.55,  y: -0.55, z: -0.15, sx: 0.48, sy: 0.48, sz: 0.48, rot: 0, hue: 0.78 },
    ] },

  { id: 'eclipse3', cat: 'meta', label: 'Eclipse',
    // Dark palette, large+small; the small one rolls around the large one
    // and periodically merges at the equator.
    defaults: { palette: 'noir', spectral: true, irid: 0.6, motion: 0.65,
                sweep: 52, rim: 1.3, sss: 0.35, sheen: 0.3, metaball: true },
    forms: [
      { t: 'sphere', x: -0.2,  y:  0.05, z: 0,   sx: 0.92, sy: 0.92, sz: 0.92, rot: 0, hue: 0.0  },
      { t: 'sphere', x:  0.88, y: -0.15, z: 0.1, sx: 0.54, sy: 0.54, sz: 0.54, rot: 0, hue: 0.46 },
    ] },
]

export const SCENE_3D_BY_ID = Object.fromEntries(SCENES_3D.map((s) => [s.id, s]))
export const DEFAULT_SCENE_3D = 'binary'

// Page › Category › Preset: CATEGORIES_3D (Forms/Metaballs) list in the sidebar;
// the SCENES inside are the PRESETS picked in the rail. First category owns /softforms-3d.
export const catRoute = (id) => (id === CATEGORIES_3D[0].id ? '/softforms-3d' : `/softforms-3d/${id}`)
export const categoryById = (id) => CATEGORIES_3D.find((c) => c.id === id) || CATEGORIES_3D[0]
export const presetsForCat = (cat) => SCENES_3D.filter((s) => s.cat === cat)

export const BASE_PARAMS_3D = {
  hue: 0, irid: 1.0, sweep: 22, sheen: 0.4, gloss: 34,
  rim: 0.8, rimPow: 2.6, rimShift: 0.12, sss: 0.3,
  motion: 0.0, grain: 0.018, spectral: true,
  palette: 'spectrum', backdrop: 'black', metaball: false,
  frameMode: 'static', frameSpeed: 0.3, // Frame motion (auto-orbit), editor-side
}

export const NUMERIC_KEYS_3D = ['hue', 'irid', 'sweep', 'sheen', 'gloss', 'rim', 'rimPow', 'sss', 'motion', 'grain']

export const CTRL_SPEC_3D = {
  sweep:  { label: 'Sweep',      min: 0,    max: 360,  step: 1    },
  irid:   { label: 'Iridescence',min: 0,    max: 2.5,  step: 0.05 },
  hue:    { label: 'Hue',        min: 0,    max: 1,    step: 0.01 },
  sheen:  { label: 'Sheen',      min: 0,    max: 1.5,  step: 0.02 },
  gloss:  { label: 'Gloss',      min: 4,    max: 90,   step: 1    },
  rim:    { label: 'Rim',        min: 0,    max: 2,    step: 0.05 },
  rimPow: { label: 'Rim focus',  min: 1,    max: 6,    step: 0.1  },
  sss:    { label: 'Subsurface', min: 0,    max: 1,    step: 0.02 },
  motion: { label: 'Motion',     min: 0,    max: 1.5,  step: 0.05 },
  grain:  { label: 'Grain',      min: 0,    max: 0.12, step: 0.005},
}
