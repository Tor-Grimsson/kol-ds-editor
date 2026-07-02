// Abstract — Reaction-Diffusion model registry (Engine A of the Turing studio).
//
// One generalised CPU solver (RDEngine) runs every model; a MODEL only supplies
// its per-cell derivative + integration constants + how to seed/display it. So
// adding a reaction system (FitzHugh-Nagumo, Brusselator, Gierer-Meinhardt, …)
// later is a data entry here, not engine work.
//
// deriv(u, v, lapU, lapV, p) → [du/dt, dv/dt]  (FULL rate incl. diffusion, so a
// model can scale its own laplacian — Lengyel-Epstein needs that). The engine
// integrates U += dt·du/dt over `steps` sub-steps per rendered frame.
//
// Reaction terms lifted from the working CPU prototypes in this repo:
//   Gray-Scott  → pages/optic/reaction/engine.js  (+ Pearson regime table)
//   Oregonator  → pages/penrose/prototypes/round2/rd-02-oregonator.js
//   Schnakenberg→ pages/penrose/prototypes/round2/rd-05-aniso-schnakenberg.js (isotropic here)

// ── Models ──────────────────────────────────────────────────────────────────
// bg      : rest state the grid is filled with on reseed
// stamp   : value written where a seed shape stamps (the perturbation)
// noise   : per-cell uniform noise added to bg on reseed (Turing instability seed)
// display : which field the renderer colour-maps ('u' | 'v')
// controls: rail sliders, each editing one entry of the variation's params
export const RD_MODELS = {
  'gray-scott': {
    label: 'Gray-Scott',
    dt: 1,
    steps: 12,
    bg: { u: 1, v: 0 },
    stamp: { u: 0.5, v: 1 },
    noise: 0,
    display: 'v',
    gain: 1, // display gain before auto-normalise (kept 1 = pure auto)
    deriv: (u, v, lu, lv, p) => {
      const uvv = u * v * v
      return [0.16 * lu - uvv + p.feed * (1 - u), 0.08 * lv + uvv - (p.kill + p.feed) * v]
    },
    controls: [
      { key: 'feed', label: 'Feed', min: 0.01, max: 0.1, step: 0.001 },
      { key: 'kill', label: 'Kill', min: 0.04, max: 0.08, step: 0.001 },
    ],
  },

  schnakenberg: {
    label: 'Schnakenberg',
    dt: 0.04,
    steps: 50,
    bg: { u: 1, v: 0.9 }, // equilibrium u*=a+b, v*=b/(a+b)²  (a=0.1,b=0.9)
    stamp: { u: 1.3, v: 0.6 },
    noise: 0.04,
    display: 'u',
    // Diffusion scaled up (ratio 20 kept) → longer wavelength = bolder cells at
    // 180²; dt·Dv·4 = 0.512 < 1 stays stable.
    deriv: (u, v, lu, lv, p) => {
      const u2v = u * u * v
      return [0.16 * lu + p.a - u + u2v, 3.2 * lv + p.b - u2v]
    },
    controls: [
      { key: 'a', label: 'Feed A', min: 0.02, max: 0.2, step: 0.005 },
      { key: 'b', label: 'Feed B', min: 0.4, max: 1.6, step: 0.02 },
    ],
  },

  oregonator: {
    label: 'Oregonator (BZ)',
    dt: 0.0008,
    steps: 44,
    bg: { u: 0, v: 0 },
    stamp: { u: 1, v: 0.25 },
    noise: 0,
    display: 'u',
    clamp: [0, 1.3], // stiff (1/eps) term overshoots negative → denom blows up; bound it
    deriv: (u, v, lu, lv, p) => {
      const denom = (u < 0 ? 0 : u) + p.q
      const ru = (1 / p.eps) * (u * (1 - u) - (p.f * v * (u - p.q)) / denom) + 1.5 * lu
      const rv = u - v
      return [ru, rv]
    },
    controls: [
      { key: 'f', label: 'Stoichiometry', min: 0.6, max: 2.2, step: 0.05 },
      { key: 'eps', label: 'Epsilon', min: 0.01, max: 0.08, step: 0.005 },
    ],
  },
}

// ── Variations (the sidebar / preset list) ───────────────────────────────────
// Each is one lookable abstraction. Gray-Scott alone spans a dozen via (feed,kill)
// — the Pearson regime table; the other models add distinct reaction looks.
export const RD_VARIATIONS = [
  // Gray-Scott — Pearson regimes
  { id: 'coral', label: 'Coral', model: 'gray-scott', params: { feed: 0.0545, kill: 0.062 }, palette: 'jade', seed: 'scatter' },
  { id: 'mitosis', label: 'Mitosis', model: 'gray-scott', params: { feed: 0.0367, kill: 0.0649 }, palette: 'ink', seed: 'scatter' },
  { id: 'maze', label: 'Maze', model: 'gray-scott', params: { feed: 0.029, kill: 0.057 }, palette: 'lava', seed: 'scatter' },
  { id: 'worms', label: 'Worms', model: 'gray-scott', params: { feed: 0.046, kill: 0.063 }, palette: 'violet', seed: 'scatter' },
  { id: 'spots', label: 'Spots', model: 'gray-scott', params: { feed: 0.035, kill: 0.065 }, palette: 'gold', seed: 'scatter' },
  { id: 'solitons', label: 'Solitons', model: 'gray-scott', params: { feed: 0.018, kill: 0.051 }, palette: 'spectrum', seed: 'scatter' },
  { id: 'holes', label: 'Holes', model: 'gray-scott', params: { feed: 0.039, kill: 0.058 }, palette: 'ink', seed: 'scatter' },
  { id: 'fingerprint', label: 'Fingerprint', model: 'gray-scott', params: { feed: 0.037, kill: 0.06 }, palette: 'lava', seed: 'stripe' },
  { id: 'pulse', label: 'Pulse', model: 'gray-scott', params: { feed: 0.025, kill: 0.06 }, palette: 'jade', seed: 'center' },
  { id: 'flow', label: 'Flow', model: 'gray-scott', params: { feed: 0.026, kill: 0.051 }, palette: 'violet', seed: 'scatter' },
  // Schnakenberg
  { id: 'cells', label: 'Cells', model: 'schnakenberg', params: { a: 0.1, b: 0.9 }, palette: 'gold', seed: 'scatter' },
  // Oregonator/BZ is in RD_MODELS but not yet a variation — the excitable medium
  // decays to its steady state without broken-front spiral seeding. Deferred to the
  // next pass (custom seed) rather than ship a flat page.
]

// Defaults filled in for params a variation omits (so a model always has all knobs).
export const MODEL_DEFAULTS = {
  'gray-scott': { feed: 0.0545, kill: 0.062 },
  schnakenberg: { a: 0.1, b: 0.9 },
  oregonator: { f: 1.4, eps: 0.02, q: 0.002 },
}

export const RD_SEEDS = [
  { value: 'scatter', label: 'Scatter' },
  { value: 'center', label: 'Center' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'grid', label: 'Grid' },
]

export const RD_PALETTES = [
  { value: 'lava', label: 'Lava', stops: ['#05010a', '#7a1f0a', '#ff6b00', '#ffd23f'] },
  { value: 'gold', label: 'Gold', stops: ['#140d02', '#7a5a16', '#e0a82e', '#fff3c4'] },
  { value: 'ink', label: 'Ink', stops: ['#ffffff', '#9aa6b2', '#10131a', '#000000'] },
  { value: 'jade', label: 'Jade', stops: ['#02110d', '#0b6e4f', '#2ec4b6', '#e0fbfc'] },
  { value: 'violet', label: 'Violet', stops: ['#0a0118', '#5f0f60', '#c724b1', '#ffd1ff'] },
  { value: 'spectrum', label: 'Spectrum', stops: ['#3a0ca3', '#4361ee', '#4cc9f0', '#80ffdb', '#ffd60a', '#ff5400'] },
]

export const variationById = (id) => RD_VARIATIONS.find((v) => v.id === id)

// ── Image dither (Engine C) ──────────────────────────────────────────────────
// TexTuring's trick: run Gray-Scott with per-cell feed/kill driven by image
// brightness, so light vs dark regions grow into DIFFERENT textures and the photo
// reads through the pattern. Each style is two GS regimes — the texture at dark
// pixels (b=0) and at bright pixels (b=1); brightness lerps between them.
export const DITHER_STYLES = [
  { value: 'coral', label: 'Coral', dark: { feed: 0.0367, kill: 0.0649 }, bright: { feed: 0.0545, kill: 0.062 } },
  { value: 'maze', label: 'Maze', dark: { feed: 0.029, kill: 0.057 }, bright: { feed: 0.039, kill: 0.058 } },
  { value: 'worms', label: 'Worms', dark: { feed: 0.042, kill: 0.0612 }, bright: { feed: 0.058, kill: 0.063 } },
  { value: 'spots', label: 'Spots', dark: { feed: 0.022, kill: 0.051 }, bright: { feed: 0.035, kill: 0.065 } },
]

export const ditherStyleById = (id) => DITHER_STYLES.find((s) => s.value === id) || DITHER_STYLES[0]

// brightness: Float32Array [0,1] per cell → per-cell feed/kill maps for the engine.
export function buildFK(brightness, style, invert = false) {
  const n = brightness.length
  const feed = new Float32Array(n)
  const kill = new Float32Array(n)
  const d = style.dark
  const w = style.bright
  for (let i = 0; i < n; i++) {
    const b = invert ? 1 - brightness[i] : brightness[i]
    feed[i] = d.feed + (w.feed - d.feed) * b
    kill[i] = d.kill + (w.kill - d.kill) * b
  }
  return { feed, kill }
}
