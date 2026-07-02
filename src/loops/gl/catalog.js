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
import { GRAD_PALETTES, BACKDROPS } from './gradEnums.js'
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
const range = (key, label, min, max, step, dflt) => ({ key, label, type: 'range', min, max, step, default: dflt })

const GRAD_PALETTE_OPTS = opts(GRAD_PALETTES)
const BACKDROP_OPTS     = opts(BACKDROPS)

/* ── Drift — one loop per family (family picks the fragment shader) ──── */
const DRIFT_STYLES = {
  air:   [{ value: 'clouds', label: 'Clouds' }, { value: 'cirrus', label: 'Cirrus' }, { value: 'aurora', label: 'Aurora' }],
  water: [{ value: 'waves', label: 'Waves' }, { value: 'ripples', label: 'Ripples' }, { value: 'caustics', label: 'Caustics' }],
  cloth: [{ value: 'folds', label: 'Folds' }, { value: 'flag', label: 'Flag' }, { value: 'drape', label: 'Drape' }],
}
/* Ranges from the labs DriftEditor PARAM dict. */
const driftCommon = (family) => [
  { key: 'style', label: 'Style', type: 'select', default: DRIFT_STYLES[family][0].value, options: DRIFT_STYLES[family] },
  { key: 'palette', label: 'Palette', type: 'select', default: PALETTES[family][0].value, options: opts(PALETTES[family]) },
  range('freq', 'Scale', 0.3, 3, 0.05, 1),
  range('warp', 'Warp', 0, 3, 0.05, 1.6),
  range('evolve', 'Evolve', 0, 1, 0.01, 0.16),
  range('direction', 'Direction', 0, 360, 1, 25),
  range('sheen', 'Sheen', 0, 1.5, 0.05, 0.4),
  range('contrast', 'Contrast', 0.3, 2.5, 0.05, 1.1),
  range('grain', 'Grain', 0, 0.2, 0.005, 0.03),
]
const DRIFT_FAMILY_EXTRAS = {
  air: [
    range('wind', 'Gust', 0, 1.5, 0.02, 0.22),
    range('coverage', 'Coverage', 0, 1, 0.01, 0.6),
    range('soft', 'Softness', 0, 1, 0.01, 0.6),
  ],
  water: [
    range('amp', 'Amplitude', 0, 1.5, 0.02, 0.8),
    range('chop', 'Choppiness', 0, 1.5, 0.02, 0.5),
    range('foam', 'Foam', 0, 1, 0.01, 0.35),
    range('light', 'Light', 0, 360, 1, 60),
  ],
  cloth: [
    range('fold', 'Fold', 0, 2, 0.02, 0.7),
    range('drape', 'Drape', 0, 1.5, 0.02, 0.5),
    range('sway', 'Sway', 0, 1.5, 0.02, 0.5),
    range('light', 'Light', 0, 360, 1, 50),
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
const IRIDESCENT_LOOP = {
  id: 'iridescent', label: 'Iridescent', group: 'gradients', kind: 'engine', engine: 'iridescent',
  drive: 'dt', duration: 8,
  params: [
    { key: 'palette', label: 'Palette', type: 'select', default: 'spectrum', options: GRAD_PALETTE_OPTS },
    { key: 'backdrop', label: 'Backdrop', type: 'select', default: 'black', options: BACKDROP_OPTS },
    range('count', 'Count', 1, 12, 1, 5),
    range('size', 'Size', 0.1, 2, 0.05, 1),
    range('spread', 'Spread', 0, 2, 0.05, 1),
    range('irid', 'Iridescence', 0, 2, 0.05, 1),
    range('hue', 'Hue shift', 0, 1, 0.01, 0),
    range('sheen', 'Sheen', 0, 1.5, 0.05, 0.5),
    range('gloss', 'Gloss', 0, 1.5, 0.05, 0.5),
    range('warp', 'Warp', 0, 2, 0.05, 0.5),
    range('grain', 'Grain', 0, 0.2, 0.005, 0.03),
    range('speed', 'Speed', 0, 3, 0.05, 1),
  ],
}
/* cat 0=field / 1=pole / 2=volume; type indexes the shader branch. */
const IP = (id, label, cat, type, extra = {}) =>
  ({ id: `irid-${id}`, label, loop: 'iridescent', params: { cat, type, ...extra } })
const IRIDESCENT_PRESETS = [
  IP('field', 'Silk field', 0, 0),
  IP('banded', 'Banded', 0, 1, { freq: 1.4 }),
  IP('radial', 'Radial bloom', 0, 2),
  IP('monopole', 'Monopole', 1, 0),
  IP('multipole', 'Multipole', 1, 1, { count: 6 }),
  IP('blob', 'Blob', 2, 0),
  IP('spiral', 'Spiral', 2, 1),
]

/* ── Soft forms 2D / 3D — scenes carry `forms` arrays as opaque params ── */
const SOFTFORMS_PARAMS = [
  { key: 'palette', label: 'Palette', type: 'select', default: 'spectrum', options: GRAD_PALETTE_OPTS },
  { key: 'backdrop', label: 'Backdrop', type: 'select', default: 'black', options: BACKDROP_OPTS },
  range('hue', 'Hue shift', 0, 1, 0.01, 0),
  range('irid', 'Iridescence', 0, 2, 0.05, 1),
  range('sheen', 'Sheen', 0, 1.5, 0.05, 0.5),
  range('gloss', 'Gloss', 0, 1.5, 0.05, 0.5),
  range('rim', 'Rim light', 0, 2, 0.05, 1),
  range('motion', 'Motion', 0, 1.5, 0.02, 0.4),
  range('sweep', 'Sweep', 0, 360, 1, 20),
  { key: 'spectral', label: 'Spectral', type: 'toggle', default: false },
  range('grain', 'Grain', 0, 0.2, 0.005, 0.03),
  range('speed', 'Speed', 0, 3, 0.05, 1),
]
const SOFTFORMS_LOOP = {
  id: 'softforms', label: 'Soft forms', group: 'softforms', kind: 'engine', engine: 'softforms',
  drive: 'dt', duration: 8, params: SOFTFORMS_PARAMS,
}
const SOFTFORMS_PRESETS = SCENES.map((s) => ({
  id: `sf-${s.id}`, label: s.label, loop: 'softforms', sub: s.cat,
  params: { ...(s.defaults || {}), forms: s.forms },
}))

const SOFTFORMS3D_LOOP = {
  id: 'softforms3d', label: 'Soft forms 3D', group: 'softforms3d', kind: 'engine', engine: 'softforms3d',
  drive: 'dt', duration: 8,
  params: [
    ...SOFTFORMS_PARAMS,
    { key: 'metaball', label: 'Metaball', type: 'toggle', default: false },
    range('camTheta', 'Camera θ', 0, 6.28, 0.01, 0.3),
    range('camPhi', 'Camera φ', -1.2, 1.2, 0.01, 0.35),
    range('camDist', 'Camera distance', 1.5, 8, 0.05, 3),
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
  id: 'scene3d', label: '3D scene', group: 'scene', kind: 'engine', engine: 'scene',
  drive: 'seek', duration: 8,
  params: [
    { key: 'primitive', label: 'Primitive', type: 'select', default: 'torusKnot', options: opts(PRIMITIVES) },
    { key: 'pose', label: 'Motion', type: 'select', default: 'spin', options: opts(POSE_PRESETS) },
    range('count', 'Count', 1, 9, 1, 1),
    { key: 'arrangement', label: 'Arrangement', type: 'select', default: 'single', options: ARRANGEMENTS },
    range('spread', 'Spread', 0.5, 5, 0.1, 2.2),
    range('objectSize', 'Object size', 0.2, 3, 0.05, 1),
    range('stagger', 'Stagger', 0, 1, 0.05, 0),
    { key: 'materialType', label: 'Material', type: 'select', default: 'standard', options: MATERIALS },
    { key: 'sceneColor', label: 'Color', type: 'color', default: '#b9c2d0' },
    range('roughness', 'Roughness', 0, 1, 0.02, 0.38),
    range('metalness', 'Metalness', 0, 1, 0.02, 0.18),
    { key: 'wireframe', label: 'Wireframe', type: 'toggle', default: false },
    range('strokeWidth', 'Stroke width', 1, 10, 0.5, 3),
    range('fov', 'FOV', 15, 90, 1, 38),
    { key: 'cameraMotion', label: 'Camera orbit', type: 'toggle', default: false },
    range('orbitSpeed', 'Orbit speed', 0, 3, 0.05, 1),
    { key: 'environment', label: 'Environment', type: 'toggle', default: false },
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
  id: 'meshgradient', label: 'Mesh gradient', group: 'gradients', kind: 'engine', engine: 'mesh',
  drive: 'dt', duration: 8,
  params: [
    range('seed', 'Seed', 1, 40, 1, 7),
    { key: 'shape', label: 'Shape', type: 'select', default: 'sphere', options: MESH_SHAPES.map((s) => ({ value: s, label: s === 'sphere' ? 'Sphere' : 'Plane' })) },
    { key: 'palette', label: 'Palette', type: 'select', default: 'spectrum', options: MESH_PALETTES.map((p) => ({ value: p.id, label: p.label })) },
    range('hueShift', 'Hue shift', 0, 360, 1, 0),
    { key: 'driver', label: 'Driver', type: 'select', default: 0, options: MESH_DRIVERS.map((d) => ({ value: d.id, label: d.label })), numeric: true },
    range('distort', 'Distort', 0.1, 1.2, 0.02, 0.5),
    range('glow', 'Glow', 0, 1, 0.02, 0.6),
    range('grain', 'Grain', 0, 0.2, 0.005, 0.06),
    range('bgAmount', 'Backdrop', 0, 1, 0.02, 0.85),
    { key: 'bgStyle', label: 'Backdrop style', type: 'select', default: 0, options: MESH_BG_STYLES.map((b) => ({ value: b.id, label: b.label })), numeric: true },
    range('speed', 'Speed', 0.2, 3, 0.05, 1),
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
  id: 'forms3d', label: 'Forms', group: 'forms', kind: 'engine', engine: 'forms',
  drive: 'seek', duration: 8,
  params: [
    { key: 'form', label: 'Form', type: 'select', default: 'helix', options: opts(FORMS) },
    range('samples', 'Density', 8, 60, 1, 30),
    range('cycles', 'Cycles', 1, 6, 1, 2),
    range('amp', 'Amplitude', 0, 1.5, 0.05, 0.35),
    range('pointSize', 'Point size', 0.01, 0.2, 0.005, 0.05),
    range('turns', 'Turns', 0.5, 6, 0.1, 2.5),
    range('radius', 'Radius', 0.2, 2, 0.05, 0.85),
    range('height', 'Height', 0.5, 4, 0.1, 2.4),
    { key: 'spin', label: 'Spin', type: 'toggle', default: false },
    range('spinSpeed', 'Spin speed', 0, 3, 0.05, 1),
    range('fov', 'FOV', 15, 90, 1, 40),
    { key: 'formColor', label: 'Color', type: 'color', role: 'fg', default: '#e5dfcf' },
    { key: 'accent', label: 'Accent', type: 'color', role: 'accent', default: '#8b8fd6' },
  ],
}
const FORMS_PRESETS = FORMS.map((f) =>
  ({ id: `forms-${f.id}`, label: f.label, loop: 'forms3d', params: { form: f.id } }))

const ENV_LOOP = {
  id: 'environment', label: 'Environment', group: 'environment', kind: 'engine', engine: 'environment',
  drive: 'seek', duration: 8,
  params: [
    { key: 'env', label: 'Scene', type: 'select', default: 'mountain', options: opts(ENVIRONMENTS) },
    range('samples', 'Density', 16, 96, 1, 48),
    range('cycles', 'Cycles', 1, 6, 1, 2),
    range('amp', 'Amplitude', 0, 1.5, 0.05, 0.5),
    { key: 'spin', label: 'Spin', type: 'toggle', default: false },
    range('spinSpeed', 'Spin speed', 0, 3, 0.05, 1),
    range('fov', 'FOV', 15, 90, 1, 45),
    { key: 'formColor', label: 'Color', type: 'color', role: 'fg', default: '#e5dfcf' },
    { key: 'accent', label: 'Accent', type: 'color', role: 'accent', default: '#8b8fd6' },
  ],
}
const ENV_PRESETS = ENVIRONMENTS.map((e) =>
  ({ id: `env-${e.id}`, label: e.label, loop: 'environment', params: { env: e.id } }))

const RIBBON_LOOP = {
  id: 'ribbon', label: 'Ribbon', group: 'ribbon', kind: 'engine', engine: 'ribbon',
  drive: 'seek', duration: 12,
  params: [
    /* geometry (rebuilds the swept ribbon) */
    range('seed', 'Seed', 1, 40, 1, 1),
    range('loops', 'Loops', 1, 6, 1, 3),
    range('height', 'Height', 0.5, 4, 0.1, 2.2),
    range('gap', 'Gap', 0.3, 1.6, 0.02, 0.92),
    range('depth', 'Depth', 0, 1, 0.02, 0.35),
    range('curl', 'Curl', 0, 3, 0.05, 1),
    range('width', 'Width', 0.1, 1.2, 0.02, 0.5),
    /* look */
    { key: 'materialType', label: 'Material', type: 'select', default: 'glass',
      options: [{ value: 'glass', label: 'Glass' }, { value: 'chrome', label: 'Chrome' }] },
    { key: 'ribbonColor', label: 'Color', type: 'color', role: 'fg', default: '#cfe0ff' },
    range('roughness', 'Roughness', 0, 1, 0.02, 0.05),
    range('metalness', 'Metalness', 0, 1, 0.02, 1),
    range('ior', 'IOR', 1, 2.4, 0.01, 1.55),
    range('dispersion', 'Dispersion', 0, 20, 0.5, 10),
    { key: 'background', label: 'Backdrop', type: 'color', role: 'bg', default: '#000000' },
    /* motion + post */
    range('flow', 'Flow', 0, 1, 0.01, 0.6),
    { key: 'cameraOrbit', label: 'Camera orbit', type: 'toggle', default: false },
    range('orbitSpeed', 'Orbit speed', 0, 3, 0.05, 0.6),
    range('fov', 'FOV', 15, 90, 1, 36),
    range('aberration', 'Aberration', 0, 3, 0.05, 1),
    range('bloom', 'Bloom', 0, 2, 0.05, 0),
    range('vignette', 'Vignette', 0, 1, 0.02, 0.35),
    range('grain', 'Grain', 0, 0.2, 0.005, 0),
  ],
}
const RP = (id, label, params) => ({ id: `ribbon-${id}`, label, loop: 'ribbon', params })
const RIBBON_PRESETS = [
  RP('puddle', 'Puddle', {}),
  RP('chrome', 'Chrome', { materialType: 'chrome', ribbonColor: '#dfe4ea', roughness: 0.12 }),
  RP('ember', 'Ember', { ribbonColor: '#ffb36b', background: '#120802', bloom: 0.9, dispersion: 14 }),
  RP('coil', 'Coil', { seed: 7, loops: 5, curl: 1.8, width: 0.32, gap: 0.7 }),
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
