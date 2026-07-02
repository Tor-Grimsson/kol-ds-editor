/**
 * Sweep fields — the labs motion rig of kol-labs-single radar/effects/sweeps.js
 * (the Dither/ASCII pages' Motion tab), reshaped for the filter contract. A
 * sweep is a time-driven scalar field f(nx, ny, t) → 0..1 that gives a static
 * image "life": a moving wavefront picks a SHAPE (how it travels) and a TARGET
 * (what it modulates — brightness fed into the cell algorithms, cell geometry,
 * or a reveal mask that wipes the effect over the raw photo).
 *
 * Labs kept an ARRAY of stacked sweeps in page state; the filter contract's
 * params ride flat on the layer, so each filter carries ONE fully-custom sweep
 * (every shape × target from the labs rig) behind an Animate toggle —
 * SWEEP_PARAMS is the shared `tab:'anim'` schema fragment.
 *
 * Time contract: t = the transport's u∈[0,1], woven seamlessly — Speed is
 * whole wavefront cycles per loop (integer), so frame(0) === frame(1) exactly:
 *   linear/radial/angular  band position wrap01(u·cycles) — periodic ✓
 *   wave                   phase shifts by cycles·2π per loop — periodic ✓
 *   noise                  labs scrolled the lattice linearly (never seamless);
 *                          here the sample window ORBITS instead (cos/sin of
 *                          the phase, the glass.js drift trick) — periodic ✓
 */

export const SWEEP_SHAPE_OPTIONS = [
  { value: 'linear', label: 'Linear bar' },
  { value: 'radial', label: 'Radial pulse' },
  { value: 'wave', label: 'Traveling wave' },
  { value: 'angular', label: 'Radar sweep' },
  { value: 'noise', label: 'Noise drift' },
]

export const SWEEP_TARGET_OPTIONS = [
  { value: 'brightness', label: 'Brightness' },
  { value: 'geometry', label: 'Geometry' },
  { value: 'reveal', label: 'Reveal' },
]

/* Angle only steers shapes with a travel direction (labs SweepControls). */
const ANGLED_SHAPES = new Set(['linear', 'wave', 'angular'])

/* Shared `tab:'anim'` schema fragment — spread into a filter's params. Keys
 * are prefixed (sweepShape, …) so they coexist with the filter's own knobs on
 * the flat layer. Dependents are `when`-gated exactly like the labs panel:
 * everything behind Animate, Amount hidden for reveal (the mask ignores it),
 * Angle only for angled shapes. */
export const SWEEP_PARAMS = [
  { key: 'animate', label: 'Animate', type: 'toggle', default: false, noRandom: true, tab: 'anim', section: 'Motion' },
  { key: 'sweepShape', label: 'Motion', type: 'select', options: SWEEP_SHAPE_OPTIONS, default: 'linear', noRandom: true, tab: 'anim', section: 'Motion', when: (l) => !!l.animate },
  { key: 'sweepTarget', label: 'Target', type: 'select', options: SWEEP_TARGET_OPTIONS, default: 'brightness', noRandom: true, tab: 'anim', section: 'Motion', when: (l) => !!l.animate },
  { key: 'sweepAmount', label: 'Amount', type: 'range', min: -1, max: 1, step: 0.05, default: 0.6, noRandom: true, tab: 'anim', section: 'Motion', when: (l) => !!l.animate && l.sweepTarget !== 'reveal' },
  { key: 'sweepSpeed', label: 'Speed · cycles', type: 'range', min: -4, max: 4, step: 1, default: 1, noRandom: true, tab: 'anim', section: 'Motion', when: (l) => !!l.animate },
  { key: 'sweepWidth', label: 'Width', type: 'range', min: 0.05, max: 1, step: 0.01, default: 0.35, noRandom: true, tab: 'anim', section: 'Motion', when: (l) => !!l.animate },
  { key: 'sweepAngle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 0, noRandom: true, tab: 'anim', section: 'Motion', when: (l) => !!l.animate && ANGLED_SHAPES.has(l.sweepShape ?? 'linear') },
]

const TAU = Math.PI * 2
const wrap01 = (x) => x - Math.floor(x)

/* Raised falloff: 1 at the band centre, smoothly → 0 at half-width `w`. */
function band(dist, w) {
  if (w <= 0) return 0
  const t = Math.min(1, dist / w)
  return 1 - t * t * (3 - 2 * t)
}

/* Value noise (hash-lattice, smooth-interpolated) → 0..1 — labs original. */
function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash2(xi, yi), b = hash2(xi + 1, yi)
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/* Neutral packet for the no-sweep path — engines read it like evalSweep()'s. */
export const NO_SWEEP = Object.freeze({ bright: 0, scaleMul: 1, offX: 0, offY: 0, rot: 0, hasReveal: false, reveal: 0 })

/**
 * Precompute one frame's sweep state from the flat layer params + transport u.
 * Returns null when Animate is off (engines take the NO_SWEEP fast path).
 * Everything per-frame-constant (angle trig, band position, phase) happens
 * here so evalSweep() stays allocation-free in the per-cell hot loop.
 */
export function sweepState(p, u) {
  if (!p.animate) return null
  const cycles = Math.round(p.sweepSpeed ?? 1)
  const a = ((p.sweepAngle ?? 0) * Math.PI) / 180
  const width = p.sweepWidth ?? 0.35
  return {
    shape: p.sweepShape ?? 'linear',
    target: p.sweepTarget ?? 'brightness',
    amount: p.sweepAmount ?? 0.6,
    cos: Math.cos(a),
    sin: Math.sin(a),
    pos: wrap01(u * cycles), // band centre for linear/radial/angular
    ph: TAU * u * cycles, // phase for wave / noise-orbit
    halfW: Math.max(0.01, width * 0.5),
    freq: 1 + (1 - width) * 8, // wave: narrower → more stripes (labs)
    nScale: 2 + (1 - width) * 8, // noise lattice scale (labs)
  }
}

/* One sweep's wavefront value at a normalized cell (nx,ny ∈ 0..1) — the labs
 * sampleSweep() over the precomputed state (centre fixed at 0.5,0.5, as the
 * labs panel never exposed it). */
function sample(st, nx, ny) {
  switch (st.shape) {
    case 'radial': {
      const dx = nx - 0.5, dy = ny - 0.5
      const u = wrap01(Math.sqrt(dx * dx + dy * dy) / 0.7071)
      const d = Math.abs(u - st.pos)
      return band(Math.min(d, 1 - d), st.halfW)
    }
    case 'wave': {
      const u = (nx - 0.5) * st.cos + (ny - 0.5) * st.sin
      return 0.5 + 0.5 * Math.sin(u * st.freq * TAU - st.ph)
    }
    case 'angular': {
      const ang = wrap01(Math.atan2(ny - 0.5, nx - 0.5) / TAU)
      const d = Math.abs(ang - st.pos)
      return band(Math.min(d, 1 - d), st.halfW)
    }
    case 'noise':
      // labs scrolled t·speed through the lattice; the orbit closes the loop
      return vnoise(nx * st.nScale + 0.75 * Math.cos(st.ph), ny * st.nScale + 0.75 * Math.sin(st.ph))
    case 'linear':
    default: {
      const u = wrap01(0.5 + (nx - 0.5) * st.cos + (ny - 0.5) * st.sin)
      const d = Math.abs(u - st.pos)
      return band(Math.min(d, 1 - d), st.halfW)
    }
  }
}

/* Reused scratch — evaluated per cell, consumed synchronously by the engine
 * before the next call (labs evalSweeps contract; no hot-loop allocation). */
const _acc = { bright: 0, scaleMul: 1, offX: 0, offY: 0, rot: 0, hasReveal: false, reveal: 0 }

/**
 * The sweep's modulation packet at one cell:
 *   brightness → additive luma delta (± amount at the wavefront)
 *   geometry   → scale/displace/rotate the cell along the travel direction
 *   reveal     → mask; the engine gates the cell (raw photo underlay shows)
 *                when reveal < 0.5
 */
export function evalSweep(st, nx, ny) {
  _acc.bright = 0; _acc.scaleMul = 1; _acc.offX = 0; _acc.offY = 0
  _acc.rot = 0; _acc.hasReveal = false; _acc.reveal = 0
  const s = sample(st, nx, ny)
  if (st.target === 'reveal') {
    _acc.hasReveal = true
    _acc.reveal = s
  } else if (st.target === 'geometry') {
    const k = s * st.amount
    _acc.scaleMul = 1 + k
    _acc.offX = st.cos * k
    _acc.offY = st.sin * k
    _acc.rot = k
  } else {
    _acc.bright = s * st.amount
  }
  return _acc
}

/* True when the frame's sweep wipes the effect — engines draw the raw photo
 * underneath first so gated-off cells show it (labs hasRevealSweep). */
export const isReveal = (st) => !!st && st.target === 'reveal'
