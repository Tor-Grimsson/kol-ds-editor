// Abstract environments — mountain range / ocean / tunnel as displaced grid
// meshes. Not realistic, just mood pieces (the gallery's "endless" cousins to
// Forms). Each is a samples×samples grid of verts; `ph` is the loop phase in
// radians (= u_playhead · TAU · cycles), so every time term completes integer
// cycles per loop → the webm export is seamless. Mountain/Ocean are open
// planes; Tunnel wraps its u-axis into a ring (camera sits inside, looking
// down its length) — topology differs, so index building is per-id too.

const TAU = Math.PI * 2

export const ENVIRONMENTS = [
  { id: 'mountain', label: 'Mountain Range' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'tunnel', label: 'Tunnel' },
]

// Cheap deterministic "noise" — a handful of stacked sine waves at
// incommensurate frequencies. Good enough for an abstract ridge line.
function ridge(x, z) {
  return Math.sin(x * 0.9 + z * 0.4) * 0.6
    + Math.sin(x * 1.7 - z * 1.1 + 1.3) * 0.35
    + Math.sin(x * 0.35 + z * 2.3 + 2.7) * 0.5
    + Math.sin(x * 3.1 + z * 0.6 + 0.4) * 0.15
}

// (u,v in [0,1], ph radians, amp) → [x,y,z]
const BUILD = {
  mountain: (u, v, ph, amp) => {
    const x = (u * 2 - 1) * 4.2
    const z = (v * 2 - 1) * 4.2
    const base = ridge(x, z)
    const wind = Math.sin(x * 1.3 + ph) * Math.sin(z * 0.9 + ph * 0.7) * 0.12 * amp
    return [x, base + wind, z]
  },
  ocean: (u, v, ph, amp) => {
    const x = (u * 2 - 1) * 4.2
    const z = (v * 2 - 1) * 4.2
    const y = amp * (
      Math.sin(x * 1.1 + ph) * 0.5
      + Math.sin(z * 0.85 - ph * 1.3) * 0.4
      + Math.sin((x + z) * 0.6 + ph * 0.6) * 0.3
    )
    return [x, y, z]
  },
  tunnel: (u, v, ph, amp) => {
    const theta = u * TAU
    const len = (v * 2 - 1) * 6
    const ring = Math.sin(theta * 5 + len * 0.8 - ph) * 0.18 * amp
    const r = 1.7 + ring
    return [Math.cos(theta) * r, Math.sin(theta) * r, len]
  },
}

const WRAP_U = { tunnel: true }

export function isWrapped(id) {
  return !!WRAP_U[id]
}

// Fill `pos` (Float32Array, length ≥ samples*samples*3) with the env's verts.
export function writePositions(id, samples, ph, params, pos) {
  const amp = params.amp ?? 0.5
  const fn = BUILD[id] || BUILD.mountain
  let o = 0
  for (let i = 0; i < samples; i++) {
    const u = samples > 1 ? i / (samples - 1) : 0
    for (let j = 0; j < samples; j++) {
      const v = samples > 1 ? j / (samples - 1) : 0
      const p = fn(u, v, ph, amp)
      pos[o++] = p[0]; pos[o++] = p[1]; pos[o++] = p[2]
    }
  }
}

// Per-vert 0..1 gradient param for vertex colouring — height for terrain/ocean,
// depth-along-length for the tunnel.
export function writeVParam(id, samples, vpar) {
  let o = 0
  if (id === 'tunnel') {
    for (let i = 0; i < samples; i++) for (let j = 0; j < samples; j++) vpar[o++] = samples > 1 ? j / (samples - 1) : 0
    return
  }
  for (let i = 0; i < samples; i++) {
    const u = samples > 1 ? i / (samples - 1) : 0
    for (let j = 0; j < samples; j++) {
      const v = samples > 1 ? j / (samples - 1) : 0
      vpar[o++] = Math.min(1, Math.max(0, 0.5 + ridge((u * 2 - 1) * 4.2, (v * 2 - 1) * 4.2) * (id === 'ocean' ? 0 : 0.4)))
    }
  }
}

// Triangle index buffer for a samples×samples grid; wraps the u-axis (column
// 0 connects back to the last column) when the env is a tube.
export function buildIndex(id, samples) {
  const wrap = isWrapped(id)
  const cols = wrap ? samples : samples - 1
  const idx = new Uint32Array(cols * (samples - 1) * 6)
  let o = 0
  for (let i = 0; i < cols; i++) {
    const iNext = wrap ? (i + 1) % samples : i + 1
    for (let j = 0; j < samples - 1; j++) {
      const a = i * samples + j
      const b = iNext * samples + j
      const c = iNext * samples + j + 1
      const d = i * samples + j + 1
      idx[o++] = a; idx[o++] = b; idx[o++] = d
      idx[o++] = b; idx[o++] = c; idx[o++] = d
    }
  }
  return idx
}
