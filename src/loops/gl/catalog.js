/**
 * GL loop catalog — DATA ONLY (groups, loop defs, presets, editor schemas).
 * No engine imports here: the main registry consumes this eagerly for the
 * inspector pickers, while the three.js engines load lazily via host.js the
 * first time an engine loop actually renders. Keep it that way — importing
 * an engine here would drag three into the base bundle.
 *
 * A GL loop def mirrors the 2d loop contract but with `kind:'engine'` and a
 * `drive` mode instead of `draw`:
 *   drive:'phase' — deterministic renderAtPhase(u) (Drift)
 *   drive:'seek'  — seek(u) + one externally-driven frame (3D scene)
 *   drive:'dt'    — free-running frame(dt) while playing (Iridescent/SoftForms)
 */
import { PALETTES } from './driftPalettes.js'
import { SUBPAGES } from './driftRegistry.js'
import { SCENES } from './softformsRegistry.js'
import { SCENES_3D } from './softforms3dRegistry.js'
import { PRIMITIVES, PRESETS as POSE_PRESETS } from './primitivePresets.js'
import { ARRANGEMENTS } from './primitiveComposition.js'
import { GRAD_PALETTES, BACKDROPS, GRAD_LOOKS } from './gradEnums.js'
import { FORMS } from './formsShapes.js'
import { ENVIRONMENTS } from './envScenes.js'
import { SHAPES as MESH_SHAPES, DRIVERS as MESH_DRIVERS, BG_STYLES as MESH_BG_STYLES, PALETTES as MESH_PALETTES } from './meshPalettes.js'

export const GL_GROUPS = [
  { id: 'drift',       label: 'Drift' },
  { id: 'gradients',   label: 'Gradients' },
  { id: 'softforms',   label: 'Soft forms' },
  { id: 'softforms3d', label: 'Soft forms 3D' },
  { id: 'scene',       label: '3D scene' },
  { id: 'forms',       label: 'Forms' },
  { id: 'environment', label: 'Environment' },
  { id: 'ribbon',      label: 'Ribbon' },
]

/* ── shared option builders ─────────────────────────────────────────── */
const opts = (arr) => arr.map((o) => ({ value: o.value ?? o.id, label: o.label }))
const range = (key, label, min, max, step, dflt, extra) => ({ key, label, type: 'range', min, max, step, default: dflt, ...extra })
/* Sub-tab/section metadata (params/schema.js grammar) spread over a run of
 * params; a param's own explicit tab/section wins. */
const tag = (meta, params) => params.map((p) => ({ ...meta, ...p }))
const ANIM = { tab: 'anim', section: 'Motion' }
const CAM_ANIM = { tab: 'anim', section: 'Camera' }

const GRAD_PALETTE_OPTS = opts(GRAD_PALETTES)
const BACKDROP_OPTS     = opts(BACKDROPS)
const GRAD_LOOK_OPTS    = opts(GRAD_LOOKS)

/* ── Drift — one loop per family (family picks the fragment shader) ──── */
const DRIFT_STYLES = {
  air:   [{ value: 'clouds', label: 'Clouds' }, { value: 'cirrus', label: 'Cirrus' }, { value: 'aurora', label: 'Aurora' }],
  water: [{ value: 'waves', label: 'Waves' }, { value: 'ripples', label: 'Ripples' }, { value: 'caustics', label: 'Caustics' }],
  cloth: [{ value: 'folds', label: 'Folds' }, { value: 'flag', label: 'Flag' }, { value: 'drape', label: 'Drape' }],
}
/* Ranges from the labs DriftEditor PARAM dict. Per-style gates follow the
 * shaders: uWarp/clouds-sheen exist only in the air fragment (clouds branch);
 * the water caustics branch returns before uFlow/uLight/uAmp/uFoam/uSheen. */
const notCaustics = (l) => l.style !== 'caustics'
const driftCommon = (family) => [
  { key: 'style', label: 'Style', type: 'select', default: DRIFT_STYLES[family][0].value, options: DRIFT_STYLES[family], section: 'Field' },
  { key: 'palette', label: 'Palette', type: 'select', default: PALETTES[family][0].value, options: opts(PALETTES[family]), section: 'Field' },
  range('freq', 'Scale', 0.3, 3, 0.05, 1, { section: 'Field' }),
  /* uWarp is read by the air shader only (clouds domain-warp) */
  ...(family === 'air'
    ? [{ ...range('warp', 'Warp', 0, 3, 0.05, 1.6, { section: 'Field' }), when: (l) => (l.style ?? 'clouds') === 'clouds' }]
    : []),
  range('evolve', 'Evolve', 0, 1, 0.01, 0.16, ANIM),
  family === 'water'
    ? { ...range('direction', 'Direction', 0, 360, 1, 25, ANIM), when: notCaustics }
    : range('direction', 'Direction', 0, 360, 1, 25, ANIM),
  family === 'air'
    ? { ...range('sheen', 'Sheen', 0, 1.5, 0.05, 0.4, { section: 'Look' }), when: (l) => (l.style ?? 'clouds') === 'clouds' }
    : family === 'water'
      ? { ...range('sheen', 'Sheen', 0, 1.5, 0.05, 0.4, { section: 'Look' }), when: notCaustics }
      : range('sheen', 'Sheen', 0, 1.5, 0.05, 0.4, { section: 'Look' }),
  range('contrast', 'Contrast', 0.3, 2.5, 0.05, 1.1, { section: 'Look' }),
  range('grain', 'Grain', 0, 0.2, 0.005, 0.03, { section: 'Look' }),
]
const DRIFT_FAMILY_EXTRAS = {
  air: [
    range('wind', 'Gust', 0, 1.5, 0.02, 0.22, ANIM),
    range('coverage', 'Coverage', 0, 1, 0.01, 0.6, { section: 'Sky' }),
    range('soft', 'Softness', 0, 1, 0.01, 0.6, { section: 'Sky' }),
  ],
  water: tag({ section: 'Water' }, [
    { ...range('amp', 'Amplitude', 0, 1.5, 0.02, 0.8), when: notCaustics },
    range('chop', 'Choppiness', 0, 1.5, 0.02, 0.5),
    { ...range('foam', 'Foam', 0, 1, 0.01, 0.35), when: notCaustics },
    { ...range('light', 'Light', 0, 360, 1, 60), when: notCaustics },
  ]),
  cloth: [
    range('fold', 'Fold', 0, 2, 0.02, 0.7, { section: 'Cloth' }),
    range('drape', 'Drape', 0, 1.5, 0.02, 0.5, { section: 'Cloth' }),
    range('sway', 'Sway', 0, 1.5, 0.02, 0.5, ANIM),
    range('light', 'Light', 0, 360, 1, 50, { section: 'Cloth' }),
  ],
}
const driftLoop = (family, label) => ({
  id: `drift-${family}`, label, group: 'drift', kind: 'engine', engine: 'drift', family,
  drive: 'phase', duration: 8,
  params: [...driftCommon(family), ...DRIFT_FAMILY_EXTRAS[family]],
})
const DRIFT_LOOPS = [driftLoop('air', 'Air'), driftLoop('water', 'Water'), driftLoop('cloth', 'Cloth')]
const DRIFT_PRESETS = Object.entries(SUBPAGES).flatMap(([family, pages]) =>
  pages.map((p) => ({ id: `drift-${family}-${p.id}`, label: p.label, loop: `drift-${family}`, sub: family, params: { ...p.defaults } })),
)

/* ── Gradients (IridescentEngine) — cat×type pinned by preset ────────── */
/* cat/type are pinned by the preset (engine defaults: cat 2 volume, type 0
 * blobs) — several knobs only exist in some shader branches, so they gate on
 * the preset-set cat/type the same way scene3d gates on count. */
const iCat = (l) => Math.round(l.cat ?? 2)
const iType = (l) => Math.round(l.type ?? 0)
/* Manual colour knobs act only while look === 'custom' — a named look is a
 * GRAD_LOOKS recipe the engine overlays on every setParams. */
const iCustom = (l) => (l.look ?? 'custom') === 'custom'
const IRIDESCENT_LOOP = {
  id: 'iridescent', label: 'Iridescent', group: 'gradients', kind: 'engine', engine: 'iridescent',
  drive: 'dt', duration: 8,
  params: [
    { key: 'look', label: 'Look', type: 'select', default: 'custom', options: GRAD_LOOK_OPTS, section: 'Color' },
    /* uSpectral defaults ON in the engine — the palette ramp only shows once
     * it's switched off (tint() = mix(ramp, rainbow, uSpectral)). */
    { key: 'spectral', label: 'Spectral', type: 'toggle', default: true, section: 'Color', when: iCustom },
    { key: 'palette', label: 'Palette', type: 'select', default: 'spectrum', options: GRAD_PALETTE_OPTS, section: 'Color', when: (l) => iCustom(l) && !(l.spectral ?? true) },
    { key: 'backdrop', label: 'Backdrop', type: 'select', default: 'black', options: BACKDROP_OPTS, section: 'Color', when: (l) => iCat(l) === 2 && (l.look ?? 'custom') !== 'noir' },
    { ...range('count', 'Count', 1, 6, 1, 5, { section: 'Composition' }), when: (l) => (iCat(l) === 2 && iType(l) === 0) || (iCat(l) === 1 && iType(l) === 1) },
    { ...range('size', 'Size', 0.1, 2, 0.05, 1, { section: 'Composition' }), when: (l) => iCat(l) === 2 && (iType(l) === 0 || iType(l) === 2) },
    { ...range('spread', 'Spread', 0, 2, 0.05, 1, { section: 'Composition' }), when: (l) => (iCat(l) === 1 && iType(l) <= 1) || (iCat(l) === 2 && iType(l) === 0) },
    /* Per-type form knobs (labs registry CTRL_SPEC ranges + per-type
     * `controls` gating): angle steers the field branches, freq the periodic
     * ones, winds/pitch/petals/mouth shape the spiral only. Defaults equal
     * the engine's uniform fallbacks so ungated presets render unchanged. */
    { ...range('angle', 'Angle', 0, 6.2832, 0.01, 0, { section: 'Composition' }), when: (l) => iCat(l) === 0 && [0, 1, 3].includes(iType(l)) },
    { ...range('freq', 'Frequency', 0.2, 8, 0.1, 2, { section: 'Composition' }), when: (l) => (iCat(l) === 0 && (iType(l) === 1 || iType(l) === 2)) || (iCat(l) === 1 && iType(l) === 0) || (iCat(l) === 2 && iType(l) === 3) },
    { ...range('winds', 'Winds', 1, 12, 1, 5, { section: 'Composition' }), when: (l) => iCat(l) === 2 && iType(l) === 1 },
    { ...range('pitch', 'Pitch', 0.5, 6, 0.1, 2.4, { section: 'Composition' }), when: (l) => iCat(l) === 2 && iType(l) === 1 },
    { ...range('petals', 'Petals', 0, 24, 1, 9, { section: 'Composition' }), when: (l) => iCat(l) === 2 && iType(l) === 1 },
    { ...range('mouth', 'Mouth', 0.1, 1.2, 0.02, 0.5, { section: 'Composition' }), when: (l) => iCat(l) === 2 && iType(l) === 1 },
    { ...range('irid', 'Iridescence', 0, 2, 0.05, 1, { section: 'Look' }), when: (l) => iCustom(l) && !(iCat(l) === 1 && (iType(l) === 1 || iType(l) === 2)) },
    { ...range('hue', 'Hue shift', 0, 1, 0.01, 0, { section: 'Look' }), when: iCustom },
    { ...range('sheen', 'Sheen', 0, 1.5, 0.05, 0.5, { section: 'Look' }), when: (l) => iCat(l) === 2 || (iCat(l) === 1 && iType(l) <= 1) },
    /* gloss is a specular pow() exponent (labs CTRL_SPEC 4–90), not a 0–1 amount */
    { ...range('gloss', 'Gloss', 4, 90, 1, 24, { section: 'Look' }), when: (l) => iCat(l) === 2 },
    /* relief scales the volume branches' height field — labs gates it to cat 2 */
    { ...range('relief', 'Relief', 0.3, 1.6, 0.05, 0.9, { section: 'Look' }), when: (l) => iCat(l) === 2 },
    range('warp', 'Warp', 0, 2, 0.05, 0.5, { section: 'Look' }),
    range('grain', 'Grain', 0, 0.2, 0.005, 0.03, { section: 'Look' }),
    /* uSpin is a time-rate multiplier (stripe scroll / conic sweep / spiral
     * wind / ripple travel) — a motion knob, gated to the branches that read it */
    { ...range('spin', 'Spin', -3, 3, 0.1, 1, ANIM), when: (l) => (iCat(l) === 0 && (iType(l) === 1 || iType(l) === 3)) || (iCat(l) === 2 && (iType(l) === 1 || iType(l) === 3)) },
    range('speed', 'Speed', 0, 3, 0.05, 1, ANIM),
  ],
}
/* cat 0=field / 1=pole / 2=volume; type indexes the shader branch. */
const IP = (id, label, cat, type, extra = {}) =>
  ({ id: `irid-${id}`, label, loop: 'iridescent', params: { cat, type, ...extra } })
/* Extras on the labs-ported presets pin that type's labs registry defaults
 * where they differ from the engine's (blobs-centric) uniform defaults. */
const IRIDESCENT_PRESETS = [
  IP('field', 'Silk field', 0, 0),
  IP('banded', 'Banded', 0, 1, { freq: 1.4 }),
  IP('radial', 'Radial bloom', 0, 2),
  IP('conic', 'Conic sweep', 0, 3, { irid: 1, warp: 0, spin: 0.3 }),
  IP('monopole', 'Monopole', 1, 0),
  IP('multipole', 'Multipole', 1, 1, { count: 6 }),
  IP('mesh', 'Mesh blend', 1, 2, { spectral: false, palette: 'candy', warp: 0.18 }),
  IP('aurora', 'Aurora', 1, 3, { irid: 1, hue: 0.5, spectral: false, palette: 'aqua', warp: 0 }),
  IP('blob', 'Blob', 2, 0),
  IP('spiral', 'Spiral', 2, 1),
  IP('dome', 'Dome', 2, 2, { size: 0.6, irid: 1.1, hue: 0.3, sheen: 0.6, gloss: 30, relief: 1, warp: 0.08 }),
  IP('ripple', 'Ripple', 2, 3, { irid: 1, hue: 0.55, spectral: false, palette: 'aqua', freq: 3, relief: 1, gloss: 20, warp: 0.05, backdrop: 'abyss' }),
]

/* ── Soft forms 2D / 3D — scenes carry `forms` arrays as opaque params ── */
const SOFTFORMS_PARAMS = [
  { key: 'spectral', label: 'Spectral', type: 'toggle', default: false, section: 'Color' },
  /* tint() = mix(ramp, rainbow, uSpectral) — the palette ramp only shows while
   * Spectral is off. */
  { key: 'palette', label: 'Palette', type: 'select', default: 'spectrum', options: GRAD_PALETTE_OPTS, section: 'Color', when: (l) => !l.spectral },
  { key: 'backdrop', label: 'Backdrop', type: 'select', default: 'black', options: BACKDROP_OPTS, section: 'Color' },
  range('hue', 'Hue shift', 0, 1, 0.01, 0, { section: 'Look' }),
  range('irid', 'Iridescence', 0, 2, 0.05, 1, { section: 'Look' }),
  range('sheen', 'Sheen', 0, 1.5, 0.05, 0.5, { section: 'Look' }),
  /* gloss is a specular pow() exponent (labs CTRL_SPEC 4–90), not a 0–1 amount */
  range('gloss', 'Gloss', 4, 90, 1, 32, { section: 'Look' }),
  range('rim', 'Rim light', 0, 2, 0.05, 1, { section: 'Look' }),
  /* labs registry CTRL_SPEC ranges; defaults = labs BASE_PARAMS (engine map
   * uRimPow/uRimShift/uSSS — both the 2D and 3D engines read all three) */
  range('rimPow', 'Rim focus', 1, 6, 0.1, 2.6, { section: 'Look' }),
  range('rimShift', 'Rim shift', 0, 0.5, 0.01, 0.12, { section: 'Look' }),
  range('sss', 'Subsurface', 0, 1, 0.02, 0.25, { section: 'Look' }),
  range('motion', 'Motion', 0, 1.5, 0.02, 0.4, ANIM),
  range('sweep', 'Sweep', 0, 360, 1, 20, ANIM),
  range('grain', 'Grain', 0, 0.2, 0.005, 0.03, { section: 'Look' }),
  range('speed', 'Speed', 0, 3, 0.05, 1, ANIM),
]
const SOFTFORMS_LOOP = {
  id: 'softforms', label: 'Soft forms', group: 'softforms', kind: 'engine', engine: 'softforms',
  drive: 'dt', duration: 8,
  params: [
    ...SOFTFORMS_PARAMS,
    /* 2D-only surface knobs — the 3D engine's param map reads neither */
    range('bulge', 'Bulge', 0.2, 1.2, 0.02, 0.55, { section: 'Form' }),
    range('relief', 'Relief', 0.2, 2.5, 0.05, 1, { section: 'Form' }),
  ],
}
const SOFTFORMS_PRESETS = SCENES.map((s) => ({
  id: `sf-${s.id}`, label: s.label, loop: 'softforms', sub: s.cat,
  params: { ...(s.defaults || {}), forms: s.forms },
}))

const SOFTFORMS3D_LOOP = {
  id: 'softforms3d', label: 'Soft forms 3D', group: 'softforms3d', kind: 'engine', engine: 'softforms3d',
  drive: 'dt', duration: 8,
  /* Drag-orbit contract: which param keys the camera drag writes (host
   * setCamera maps camTheta/camPhi/camDist → uTheta/uPhi/uDist). */
  cameraKeys: { yaw: 'camTheta', pitch: 'camPhi', dist: 'camDist' },
  params: [
    ...SOFTFORMS_PARAMS,
    { key: 'metaball', label: 'Metaball', type: 'toggle', default: false, section: 'Form' },
    range('camTheta', 'Camera θ', 0, 6.28, 0.01, 0.3, { section: 'Camera' }),
    range('camPhi', 'Camera φ', -1.2, 1.2, 0.01, 0.35, { section: 'Camera' }),
    range('camDist', 'Camera distance', 1.5, 8, 0.05, 3, { section: 'Camera' }),
  ],
}
const SOFTFORMS3D_PRESETS = SCENES_3D.map((s) => ({
  id: `sf3-${s.id}`, label: s.label, loop: 'softforms3d', sub: s.cat,
  params: { ...(s.defaults || {}), forms: s.forms },
}))

/* ── 3D scene (PrimitiveEngine) ──────────────────────────────────────── */
const MATERIALS = [
  { value: 'standard', label: 'Standard' },
  { value: 'phong', label: 'Phong' },
  { value: 'toon', label: 'Toon' },
  { value: 'normal', label: 'Normal' },
  { value: 'glass', label: 'Glass' },
  { value: 'dispersion', label: 'Dispersion' },
]
const SCENE_LOOP = {
  id: 'scene3d', label: '3D scene', group: 'scene', kind: 'engine', engine: 'scene', orbit: true, bgToggle: true,
  drive: 'seek', duration: 8,
  params: [
    { key: 'primitive', label: 'Primitive', type: 'select', default: 'torusKnot', options: opts(PRIMITIVES), section: 'Primitive' },
    /* Per-primitive shape knobs (labs SHAPE_PARAM gating; engine
     * buildGeometry reads tube/p/q/detail via params, rounding via globals —
     * pWinds/qWinds are the host-contract names for the knot's p/q). */
    { ...range('tube', 'Tube', 0.1, 0.45, 0.01, 0.32, { section: 'Primitive' }), when: (l) => (l.primitive ?? 'torusKnot') === 'torus' },
    { ...range('pWinds', 'P winds', 1, 5, 1, 2, { section: 'Primitive' }), when: (l) => (l.primitive ?? 'torusKnot') === 'torusKnot' },
    { ...range('qWinds', 'Q winds', 1, 5, 1, 3, { section: 'Primitive' }), when: (l) => (l.primitive ?? 'torusKnot') === 'torusKnot' },
    { ...range('detail', 'Detail', 0, 3, 1, 0, { section: 'Primitive' }), when: (l) => ['icosahedron', 'octahedron', 'dodecahedron'].includes(l.primitive ?? 'torusKnot') },
    { ...range('rounding', 'Rounding', 0, 0.7, 0.02, 0.22, { section: 'Primitive' }), when: (l) => (l.primitive ?? 'torusKnot') === 'box' },
    /* animMode/duration — host-wiring contract keys (keyframes data itself is
     * opaque layer state, no schema entry). */
    { key: 'animMode', label: 'Animation', type: 'select', default: 'preset', noRandom: true, tab: 'anim', section: 'Motion',
      options: [{ value: 'preset', label: 'Preset' }, { value: 'keyframes', label: 'Keyframes' }] },
    { key: 'pose', label: 'Motion', type: 'select', default: 'spin', options: opts(POSE_PRESETS), tab: 'anim', section: 'Motion', when: (l) => (l.animMode ?? 'preset') === 'preset' },
    range('duration', 'Duration (s)', 2, 30, 0.5, 8, { ...ANIM, noRandom: true }),
    range('count', 'Count', 1, 24, 1, 1, { section: 'Composition' }),
    /* Multi-object knobs are no-ops at count 1 — hidden until they act. */
    { key: 'arrangement', label: 'Arrangement', type: 'select', default: 'single', options: ARRANGEMENTS, when: (l) => (l.count ?? 1) > 1, section: 'Composition' },
    { ...range('spread', 'Spread', 0.5, 5, 0.1, 2.2, { section: 'Composition' }), when: (l) => (l.count ?? 1) > 1 },
    range('objectSize', 'Object size', 0.2, 3, 0.05, 1, { section: 'Composition' }),
    { ...range('stagger', 'Stagger', 0, 1, 0.05, 0, { section: 'Composition' }), when: (l) => (l.count ?? 1) > 1 },
    { key: 'materialType', label: 'Material', type: 'select', default: 'standard', options: MATERIALS, section: 'Material' },
    /* Material-dependent knobs (per makeMaterial/applyMaterialProps):
     * normal ignores colour; roughness exists on standard + the physical pair;
     * metalness only applies to standard; env IBL only lights PBR materials. */
    { key: 'sceneColor', label: 'Color', type: 'color', default: '#b9c2d0', section: 'Material', when: (l) => (l.materialType ?? 'standard') !== 'normal' || !!l.wireframe },
    { ...range('roughness', 'Roughness', 0, 1, 0.02, 0.38, { section: 'Material' }), when: (l) => ['standard', 'glass', 'dispersion'].includes(l.materialType ?? 'standard') },
    { ...range('metalness', 'Metalness', 0, 1, 0.02, 0.18, { section: 'Material' }), when: (l) => (l.materialType ?? 'standard') === 'standard' },
    { key: 'flatShading', label: 'Flat shading', type: 'toggle', default: false, section: 'Material' },
    { key: 'wireframe', label: 'Wireframe', type: 'toggle', default: false, section: 'Material' },
    { ...range('strokeWidth', 'Stroke width', 1, 10, 0.5, 3, { section: 'Material' }), when: (l) => !!l.wireframe },
    { key: 'environment', label: 'Environment', type: 'toggle', default: false, section: 'Material', when: (l) => ['standard', 'glass', 'dispersion'].includes(l.materialType ?? 'standard') },
    range('fov', 'FOV', 15, 90, 1, 38, { section: 'Camera' }),
    { key: 'cameraMotion', label: 'Camera orbit', type: 'toggle', default: false, tab: 'anim', section: 'Camera' },
    { ...range('orbitSpeed', 'Orbit speed', 0, 3, 0.05, 1, CAM_ANIM), when: (l) => !!l.cameraMotion },
    /* XYZ axes overlay (engine this.axes — scale + material opacity).
     * noRandom: a debug guide is curation, not look — keep rolls off it. */
    { key: 'showAxis', label: 'Show XYZ axis', type: 'toggle', default: false, section: 'Guides', noRandom: true },
    { ...range('axisLength', 'Axis length', 0.5, 4, 0.1, 1.5, { section: 'Guides', noRandom: true }), when: (l) => !!l.showAxis },
    { ...range('axisOpacity', 'Axis opacity', 0, 1, 0.05, 0.7, { section: 'Guides', noRandom: true }), when: (l) => !!l.showAxis },
  ],
}
const SP = (id, label, params) => ({ id: `scene-${id}`, label, loop: 'scene3d', params })
const SCENE_PRESETS = [
  SP('knot', 'Knot spin', { primitive: 'torusKnot', pose: 'spin', materialType: 'standard' }),
  SP('tumble', 'Cube tumble', { primitive: 'box', pose: 'tumble', materialType: 'phong' }),
  SP('ring', 'Sphere ring', { primitive: 'sphere', pose: 'bob', count: 6, arrangement: 'ring', spread: 2.4, stagger: 1, objectSize: 0.5 }),
  SP('glass', 'Glass icosa', { primitive: 'icosahedron', pose: 'spin', materialType: 'glass', environment: true }),
  SP('wire', 'Wire grid', { primitive: 'octahedron', pose: 'tumble', count: 9, arrangement: 'grid', spread: 2.8, wireframe: true, objectSize: 0.45, stagger: 0.5 }),
]

/* ── Mesh gradient (GradientEngine, single tile) — second loop in the
 * 'gradients' group; presets switch loopId within the group. Free-running
 * (dt) — the one engine the audit flagged as non-seamless; fine as an
 * ambient generator. */
const MESH_LOOP = {
  id: 'meshgradient', label: 'Mesh gradient', group: 'gradients', kind: 'engine', engine: 'mesh', orbit: true,
  drive: 'dt', duration: 8,
  params: [
    /* engine update({mode}) — 'grid' renders the seed's whole tile sheet
     * (host passthrough is B3 wiring; structural, so noRandom) */
    { key: 'mode', label: 'Mode', type: 'select', default: 'single', noRandom: true, section: 'Field',
      options: [{ value: 'single', label: 'Single' }, { value: 'grid', label: 'Grid' }] },
    range('seed', 'Seed', 1, 40, 1, 7, { section: 'Field' }),
    { key: 'shape', label: 'Shape', type: 'select', default: 'sphere', options: MESH_SHAPES.map((s) => ({ value: s, label: s === 'sphere' ? 'Sphere' : 'Plane' })), section: 'Field' },
    range('distort', 'Distort', 0.1, 1.2, 0.02, 0.5, { section: 'Field' }),
    range('glow', 'Glow', 0, 1, 0.02, 0.6, { section: 'Field' }),
    range('grain', 'Grain', 0, 0.2, 0.005, 0.06, { section: 'Field' }),
    { key: 'palette', label: 'Palette', type: 'select', default: 'spectrum', options: MESH_PALETTES.map((p) => ({ value: p.id, label: p.label })), section: 'Color' },
    range('hueShift', 'Hue shift', 0, 360, 1, 0, { section: 'Color' }),
    range('bgAmount', 'Backdrop', 0, 1, 0.02, 0.85, { section: 'Backdrop' }),
    { key: 'bgStyle', label: 'Backdrop style', type: 'select', default: 0, options: MESH_BG_STYLES.map((b) => ({ value: b.id, label: b.label })), numeric: true, section: 'Backdrop' },
    { key: 'driver', label: 'Driver', type: 'select', default: 0, options: MESH_DRIVERS.map((d) => ({ value: d.id, label: d.label })), numeric: true, tab: 'anim', section: 'Motion' },
    range('speed', 'Speed', 0.2, 3, 0.05, 1, ANIM),
  ],
}
const MP = (id, label, params) => ({ id: `mesh-${id}`, label, loop: 'meshgradient', sub: 'Mesh', params })
const MESH_PRESETS = [
  MP('spectrum', 'Spectrum orb', { seed: 7, shape: 'sphere', palette: 'spectrum' }),
  MP('heat', 'Heat plane', { seed: 12, shape: 'plane', palette: 'heat', distort: 0.6 }),
  MP('iris', 'Iris orb', { seed: 3, shape: 'sphere', palette: 'iris', glow: 0.8 }),
  MP('sunset', 'Sunset drift', { seed: 21, shape: 'plane', palette: 'sunset', bgStyle: 2 }),
  MP('polar', 'Polar sheet', { seed: 9, shape: 'plane', palette: 'polar', distort: 0.4 }),
  MP('acid', 'Acid orb', { seed: 16, shape: 'sphere', palette: 'acid', grain: 0.1 }),
]

/* ── Wave 2b — Forms / Environments / Ribbon (playhead engines) ──────── */
const FORMS_LOOP = {
  id: 'forms3d', label: 'Forms', group: 'forms', kind: 'engine', engine: 'forms', orbit: true, bgToggle: true,
  drive: 'seek', duration: 8,
  params: [
    { key: 'form', label: 'Form', type: 'select', default: 'helix', options: opts(FORMS) },
    /* Per formsShapes.writePositions: turns/radius/height are helix-only;
     * amp animates the grid creatures (torus + helix ignore it); torus is the
     * one static form (its fn ignores ph, so cycles does nothing there). */
    ...tag({ section: 'Geometry' }, [
      range('samples', 'Density', 8, 60, 1, 30),
      { ...range('cycles', 'Cycles', 1, 6, 1, 2), when: (l) => (l.form ?? 'helix') !== 'torus' },
      { ...range('amp', 'Amplitude', 0, 1.5, 0.05, 0.35), when: (l) => !['helix', 'torus'].includes(l.form ?? 'helix') },
      range('pointSize', 'Point size', 0.01, 0.2, 0.005, 0.05),
      { ...range('turns', 'Turns', 0.5, 6, 0.1, 2.5), when: (l) => (l.form ?? 'helix') === 'helix' },
      { ...range('radius', 'Radius', 0.2, 2, 0.05, 0.85), when: (l) => (l.form ?? 'helix') === 'helix' },
      { ...range('height', 'Height', 0.5, 4, 0.1, 2.4), when: (l) => (l.form ?? 'helix') === 'helix' },
    ]),
    { key: 'spin', label: 'Spin', type: 'toggle', default: false, tab: 'anim', section: 'Motion' },
    { ...range('spinSpeed', 'Spin speed', 0, 3, 0.05, 1, ANIM), when: (l) => !!l.spin },
    range('fov', 'FOV', 15, 90, 1, 40, { section: 'Camera' }),
    { key: 'formColor', label: 'Color', type: 'color', role: 'fg', default: '#e5dfcf', section: 'Color' },
    { key: 'accent', label: 'Accent', type: 'color', role: 'accent', default: '#8b8fd6', section: 'Color' },
  ],
}
const FORMS_PRESETS = FORMS.map((f) =>
  ({ id: `forms-${f.id}`, label: f.label, loop: 'forms3d', params: { form: f.id } }))

const ENV_LOOP = {
  id: 'environment', label: 'Environment', group: 'environment', kind: 'engine', engine: 'environment', orbit: true, bgToggle: true,
  drive: 'seek', duration: 8,
  params: [
    { key: 'env', label: 'Scene', type: 'select', default: 'mountain', options: opts(ENVIRONMENTS) },
    range('samples', 'Density', 16, 96, 1, 48, { section: 'Geometry' }),
    range('cycles', 'Cycles', 1, 6, 1, 2, { section: 'Geometry' }),
    range('amp', 'Amplitude', 0, 1.5, 0.05, 0.5, { section: 'Geometry' }),
    /* The engine suppresses auto-rotate for wrapped scenes (camera sits inside
     * the tunnel) — see isWrapped() in envScenes.js. */
    { key: 'spin', label: 'Spin', type: 'toggle', default: false, tab: 'anim', section: 'Motion', when: (l) => (l.env ?? 'mountain') !== 'tunnel' },
    { ...range('spinSpeed', 'Spin speed', 0, 3, 0.05, 1, ANIM), when: (l) => !!l.spin && (l.env ?? 'mountain') !== 'tunnel' },
    range('fov', 'FOV', 15, 90, 1, 45, { section: 'Camera' }),
    { key: 'formColor', label: 'Color', type: 'color', role: 'fg', default: '#e5dfcf', section: 'Color' },
    { key: 'accent', label: 'Accent', type: 'color', role: 'accent', default: '#8b8fd6', section: 'Color' },
  ],
}
const ENV_PRESETS = ENVIRONMENTS.map((e) =>
  ({ id: `env-${e.id}`, label: e.label, loop: 'environment', params: { env: e.id } }))

const RIBBON_LOOP = {
  id: 'ribbon', label: 'Ribbon', group: 'ribbon', kind: 'engine', engine: 'ribbon', orbit: true, bgToggle: true,
  drive: 'seek', duration: 12,
  params: [
    /* geometry (rebuilds the swept ribbon) */
    ...tag({ section: 'Geometry' }, [
      range('seed', 'Seed', 1, 64, 1, 1),
      range('loops', 'Loops', 1, 6, 1, 3),
      range('height', 'Height', 0.5, 4, 0.1, 2.2),
      range('gap', 'Gap', 0.3, 1.6, 0.02, 0.92),
      range('depth', 'Depth', 0, 1, 0.02, 0.35),
      range('curl', 'Curl', 0, 3, 0.05, 1),
      range('width', 'Width', 0.1, 1.2, 0.02, 0.5),
      range('ribbonThickness', 'Flatness', 0.04, 0.3, 0.005, 0.12),
      range('corner', 'Corner', 0.01, 0.12, 0.005, 0.045),
    ]),
    /* look — applyMaterialProps splits per material: metalness is chrome-only,
     * ior/dispersion are glass-only. */
    ...tag({ section: 'Look' }, [
      { key: 'materialType', label: 'Material', type: 'select', default: 'glass',
        options: [{ value: 'glass', label: 'Glass' }, { value: 'chrome', label: 'Chrome' }] },
      { key: 'ribbonColor', label: 'Color', type: 'color', role: 'fg', default: '#cfe0ff' },
      range('roughness', 'Roughness', 0, 1, 0.02, 0.05),
      { ...range('metalness', 'Metalness', 0, 1, 0.02, 1), when: (l) => l.materialType === 'chrome' },
      { ...range('ior', 'IOR', 1, 2.4, 0.01, 1.55), when: (l) => (l.materialType ?? 'glass') === 'glass' },
      { ...range('dispersion', 'Dispersion', 0, 20, 0.5, 10), when: (l) => (l.materialType ?? 'glass') === 'glass' },
      { key: 'background', label: 'Backdrop', type: 'color', role: 'bg', default: '#000000' },
      /* fat-line overlay sibling (engine globals.wireframe/strokeWidth —
       * wireStroke is the host-contract name; labs stroke 1–8, engine dflt 2.5) */
      { key: 'wireframe', label: 'Wireframe', type: 'toggle', default: false },
      { ...range('wireStroke', 'Stroke', 1, 8, 0.5, 2.5), when: (l) => !!l.wireframe },
    ]),
    /* motion + post */
    range('flow', 'Flow', 0, 1, 0.01, 0.6, ANIM),
    /* labs Duration (s) 4–30; default 12 = the def's loop length + labs page dflt */
    range('duration', 'Duration (s)', 4, 30, 0.5, 12, { ...ANIM, noRandom: true }),
    { key: 'cameraOrbit', label: 'Camera orbit', type: 'toggle', default: false, tab: 'anim', section: 'Camera' },
    { ...range('orbitSpeed', 'Orbit speed', 0, 3, 0.05, 0.6, CAM_ANIM), when: (l) => !!l.cameraOrbit },
    range('fov', 'FOV', 15, 90, 1, 36, { section: 'Camera' }),
    ...tag({ section: 'Post' }, [
      range('aberration', 'Aberration', 0, 3, 0.05, 1),
      range('bloom', 'Bloom', 0, 2, 0.05, 0),
      range('vignette', 'Vignette', 0, 1, 0.02, 0.35),
      range('grain', 'Grain', 0, 0.2, 0.005, 0),
    ]),
  ],
}
const RP = (id, label, params) => ({ id: `ribbon-${id}`, label, loop: 'ribbon', params })
const RIBBON_PRESETS = [
  RP('puddle', 'Puddle', {}),
  RP('chrome', 'Chrome', { materialType: 'chrome', ribbonColor: '#dfe4ea', roughness: 0.12 }),
  RP('ember', 'Ember', { ribbonColor: '#ffb36b', background: '#120802', bloom: 0.9, dispersion: 14 }),
  RP('coil', 'Coil', { seed: 7, loops: 5, curl: 1.8, width: 0.32, gap: 0.7 }),
  /* Labs ribbon presets (geometry recipes) — unset keys ride the schema
   * defaults, which equal the labs 'cascade' baseline apart from seed. */
  RP('cascade', 'Cascade', { seed: 3 }),
  RP('tower', 'Tower', { seed: 17, loops: 4, height: 2.9, gap: 0.7, depth: 0.26, curl: 0.5, width: 0.44, ribbonThickness: 0.11, corner: 0.04, materialType: 'chrome' }),
  RP('plunge', 'Plunge', { seed: 23, loops: 1, height: 2.5, gap: 1, depth: 0.62, curl: 1.9, width: 0.55, ribbonThickness: 0.13, corner: 0.05 }),
  RP('braid', 'Braid', { seed: 41, loops: 2, height: 1.9, gap: 0.88, depth: 0.72, curl: 0.8, width: 0.64, ribbonThickness: 0.14, corner: 0.055, materialType: 'chrome' }),
  RP('fan', 'Fan', { seed: 7, loops: 5, height: 1.5, gap: 0.66, depth: 0.2, curl: 0.35, width: 0.46, ribbonThickness: 0.1, corner: 0.036 }),
  RP('arch', 'Arch', { seed: 61, loops: 2, height: 3.1, gap: 1.12, depth: 0.48, curl: 1.1, width: 0.48, ribbonThickness: 0.115, corner: 0.042, materialType: 'chrome' }),
  RP('wave', 'Wave', { seed: 13, loops: 4, height: 1.8, gap: 0.78, depth: 0.8, curl: 0.9 }),
  RP('knot', 'Knot', { seed: 37, loops: 3, height: 2, gap: 0.62, depth: 0.3, curl: 1.7, width: 0.42, ribbonThickness: 0.1, corner: 0.036 }),
  RP('slab', 'Slab', { seed: 29, loops: 2, height: 2.5, gap: 1.02, depth: 0.28, curl: 0.5, width: 0.86, ribbonThickness: 0.065, corner: 0.022, materialType: 'chrome' }),
]

/* ── exports the main registry merges ────────────────────────────────── */
export const GL_LOOPS = [
  ...DRIFT_LOOPS, IRIDESCENT_LOOP, MESH_LOOP, SOFTFORMS_LOOP, SOFTFORMS3D_LOOP, SCENE_LOOP,
  FORMS_LOOP, ENV_LOOP, RIBBON_LOOP,
]
export const GL_PRESETS_BY_GROUP = {
  drift: DRIFT_PRESETS,
  gradients: [...IRIDESCENT_PRESETS, ...MESH_PRESETS],
  softforms: SOFTFORMS_PRESETS,
  softforms3d: SOFTFORMS3D_PRESETS,
  scene: SCENE_PRESETS,
  forms: FORMS_PRESETS,
  environment: ENV_PRESETS,
  ribbon: RIBBON_PRESETS,
}
