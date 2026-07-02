// Parametric point-cloud forms — the helix + 7 "creatures" ported from the
// interfaces lofi widgets (creature3d / helix), here as real 3D point clouds for
// the de-lofi'd /forms pages. Each grid form is a pure fn (u,v,ph)->[x,y,z]
// over a samples×samples grid; helix is two twisting strands. `ph` is the loop
// phase in radians (= u_playhead · TAU · cycles), so every time term completes
// integer cycles per loop → the webm export is seamless.

const TAU = Math.PI * 2

// (u,v in [0,1], ph radians, amp = flap amount) → [x,y,z]
const GRID = {
  manta: (u, v, ph, amp) => {
    const U = u * 2 - 1, V = v * 2 - 1
    const x = U * 1.35
    const z = V * 0.65
    const body = Math.pow(Math.max(0, 1 - U * U * 0.55 - V * V * 0.9), 0.5) * 0.18
    const flap = Math.sin(ph + U * Math.PI * 0.2) * Math.pow(Math.abs(U), 1.3) * amp
    return [x, flap + body, z]
  },
  whale: (u, v, ph, amp) => {
    const U = u * 2 - 1, V = v * 2 - 1
    const bodyTaper = Math.pow(Math.max(0, 1 - U * U), 0.55)
    const x = U * 2.1
    const thickness = bodyTaper * 0.42
    const y = V * thickness
    const z = Math.cos(v * Math.PI) * thickness
    const tailFactor = Math.max(0, (U - 0.55) / 0.45)
    const tail = Math.sin(ph) * amp * tailFactor * tailFactor * 1.2
    return [x, y + tail, z]
  },
  wing: (u, v, ph, amp) => {
    const U = u * 2 - 1, V = v * 2 - 1
    const x = U * 1.4
    const z = V * 0.95 - 0.1
    const thin = Math.pow(Math.max(0, 1 - V * V * 0.7), 0.6) * 0.08
    const flap = Math.sin(ph + U * Math.PI * 0.35) * Math.abs(U) * amp
    return [x, flap + thin, z]
  },
  blob: (u, v, ph, amp) => {
    const phi = u * TAU
    const theta = v * Math.PI
    const r = 1
      + Math.sin(u * 4 * Math.PI + ph) * 0.12
      + Math.sin(v * 3 * Math.PI + ph) * 0.1
      + Math.sin((u + v) * 5 + ph) * 0.06 * amp
    return [r * Math.sin(theta) * Math.cos(phi), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(phi)]
  },
  torus: (u, v) => {
    const phi = u * TAU
    const theta = v * TAU
    const R = 1.15, r = 0.42
    return [(R + r * Math.cos(theta)) * Math.cos(phi), r * Math.sin(theta), (R + r * Math.cos(theta)) * Math.sin(phi)]
  },
  core: (u, v, ph, amp) => {
    const U = u * 2 - 1, V = v * 2 - 1
    const ex = Math.pow(Math.abs(U), 4) + Math.pow(Math.abs(V), 4)
    const shellR = ex > 0 ? Math.pow(ex, 0.25) : 0.01
    const norm = shellR > 0 ? 1 / shellR : 0
    const xN = U * norm
    const zN = V * norm
    const angle = Math.atan2(zN, xN)
    const spike = Math.max(0, Math.cos(angle * 4)) * 0.35
    const breath = Math.sin(ph) * 0.04 * amp
    const rOuter = 1 + spike + breath
    const yPuff = Math.max(0, 1 - xN * xN - zN * zN) * 0.35
    return [xN * rOuter, yPuff * (v < 0.5 ? 1 : -1), zN * rOuter]
  },
  squid: (u, v, ph, amp) => {
    const idx = Math.floor(u * 8) // 8 tentacles indexed by u
    const ang = (idx / 8) * TAU
    const tLen = v * 2.0
    const curl = Math.sin(v * Math.PI * 2.5 + ph + idx * 0.8) * amp * v * 0.9
    const headBulb = v < 0.15 ? (0.15 - v) * 2 : 0
    const reach = 0.25 + tLen * 0.35 + headBulb * 0.6
    const x = Math.cos(ang) * reach + curl * Math.cos(ang + Math.PI / 2)
    const z = Math.sin(ang) * reach + curl * Math.sin(ang + Math.PI / 2)
    return [x, -tLen + 0.5, z]
  },
}

export const FORMS = [
  { id: 'helix', label: 'Helix' },
  { id: 'manta', label: 'Manta' },
  { id: 'whale', label: 'Whale' },
  { id: 'wing', label: 'Wing' },
  { id: 'blob', label: 'Blob' },
  { id: 'torus', label: 'Torus' },
  { id: 'core', label: 'Core' },
  { id: 'squid', label: 'Squid' },
]

// Point count for a form at the given density (so the engine can size buffers).
export function formCount(id, samples) {
  return id === 'helix' ? samples * 2 : samples * samples
}

// Fill `pos` (Float32Array, length ≥ count*3) with the form's points at phase ph.
// params: { amp, turns, radius, height } (helix uses turns/radius/height).
export function writePositions(id, samples, ph, params, pos) {
  const amp = params.amp ?? 0.35
  if (id === 'helix') {
    const turns = params.turns ?? 2.5
    const R = params.radius ?? 0.85
    const H = params.height ?? 2.4
    let o = 0
    for (let i = 0; i < samples; i++) {
      const u = samples > 1 ? i / (samples - 1) : 0
      const y = (u - 0.5) * H
      const ang = u * turns * TAU + ph
      pos[o++] = Math.sin(ang) * R; pos[o++] = y; pos[o++] = Math.cos(ang) * R
      pos[o++] = Math.sin(ang + Math.PI) * R; pos[o++] = y; pos[o++] = Math.cos(ang + Math.PI) * R
    }
    return samples * 2
  }
  const fn = GRID[id] || GRID.manta
  let o = 0
  for (let i = 0; i < samples; i++) {
    const u = samples > 1 ? i / (samples - 1) : 0
    for (let j = 0; j < samples; j++) {
      const v = samples > 1 ? j / (samples - 1) : 0
      const p = fn(u, v, ph, amp)
      pos[o++] = p[0]; pos[o++] = p[1]; pos[o++] = p[2]
    }
  }
  return samples * samples
}

// Per-point gradient parameter (0..1) for vertex colouring (form structure).
export function writeVParam(id, samples, vpar) {
  let o = 0
  if (id === 'helix') {
    for (let i = 0; i < samples; i++) { const u = samples > 1 ? i / (samples - 1) : 0; vpar[o++] = u; vpar[o++] = u }
    return samples * 2
  }
  for (let i = 0; i < samples; i++) for (let j = 0; j < samples; j++) vpar[o++] = samples > 1 ? j / (samples - 1) : 0
  return samples * samples
}
