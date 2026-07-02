// Primitive Scene — the geometry catalog + animation presets.
//
// Presets are PURE functions of normalized time u∈[0,1] → a partial transform,
// so the timeline is fully scrubbable: the figure's pose is derived from the
// playhead position, never accumulated. Missing fields fall back to identity
// (rot [0,0,0], pos [0,0,0], scale 1) in the engine.

const TAU = Math.PI * 2

// Geometry ids — the engine builds the actual THREE geometry per id (kept there
// so this data module stays dependency-free).
export const PRIMITIVES = [
  { id: 'box', label: 'Cube' },
  { id: 'sphere', label: 'Sphere' },
  { id: 'torus', label: 'Torus' },
  { id: 'torusKnot', label: 'Torus knot' },
  { id: 'cone', label: 'Cone' },
  { id: 'cylinder', label: 'Cylinder' },
  { id: 'icosahedron', label: 'Icosahedron' },
  { id: 'octahedron', label: 'Octahedron' },
  { id: 'dodecahedron', label: 'Dodecahedron' },
]

export const PRESETS = [
  { id: 'spin', label: 'Spin', sample: (u) => ({ rot: [0, u * TAU, 0] }) },
  { id: 'tumble', label: 'Tumble', sample: (u) => ({ rot: [u * TAU, u * 2 * TAU, 0] }) },
  { id: 'bob', label: 'Bob', sample: (u) => ({ pos: [0, Math.sin(u * TAU) * 0.45, 0], rot: [0, u * TAU, 0] }) },
  { id: 'pulse', label: 'Pulse', sample: (u) => ({ scale: 1 + Math.sin(u * TAU) * 0.18, rot: [0, u * TAU, 0] }) },
  { id: 'sway', label: 'Sway', sample: (u) => ({ rot: [0, Math.sin(u * TAU) * 0.6, Math.sin(u * TAU * 2) * 0.3] }) },
  { id: 'flip', label: 'Flip', sample: (u) => ({ rot: [u * TAU, 0, 0] }) },
  { id: 'orbit', label: 'Orbit', sample: (u) => ({ pos: [Math.cos(u * TAU) * 0.5, 0, Math.sin(u * TAU) * 0.5], rot: [0, -u * TAU, 0] }) },
]

// One loop = DURATION seconds at realtime (tempo 120). Tempo scales traversal
// speed; the page also exposes duration as a slider (engine reads globals.duration).
export const DURATION = 8
