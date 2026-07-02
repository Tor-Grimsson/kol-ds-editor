import * as THREE from 'three'
import { mulberry32 } from './rng.js'

/* The joe_ryba "Puddle" geometry — a flat ribbon (rounded-rect cross-section)
 * swept along a seeded serpentine centerline that folds into nested vertical
 * stadium loops and ends in a rolled curl.
 *
 * Two stages: makeRibbonCurve() builds the centerline; buildRibbonGeometry()
 * sweeps a flat profile along it (TubeGeometry-style, but a custom rounded-rect
 * cross-section instead of a circle, with end caps so the solid is closed and
 * the glass transmission reads correctly). Both are pure fns of the params, so
 * a seed change regenerates a fresh form.
 */

// A flat rounded-rectangle cross-section, centred at the origin. `u` runs along
// the ribbon WIDTH (binormal), `v` along its THICKNESS (normal) — hw >> ht gives
// the wide tape. Four quarter-arc corners joined by single straight segments, so
// the broad faces stay flat (one quad across the width).
function roundedRectProfile(hw, ht, r, n) {
  r = Math.min(r, hw, ht)
  const nc = Math.max(4, Math.round(n / 4))
  const corners = [
    { cx: hw - r, cy: ht - r, a0: 0 }, // top-right
    { cx: -(hw - r), cy: ht - r, a0: Math.PI / 2 }, // top-left
    { cx: -(hw - r), cy: -(ht - r), a0: Math.PI }, // bottom-left
    { cx: hw - r, cy: -(ht - r), a0: (3 * Math.PI) / 2 }, // bottom-right
  ]
  const pts = []
  for (const c of corners) {
    for (let i = 0; i < nc; i++) {
      const a = c.a0 + (i / nc) * (Math.PI / 2)
      pts.push({ u: c.cx + Math.cos(a) * r, v: c.cy + Math.sin(a) * r })
    }
  }
  return pts // length === 4 * nc
}

export function makeRibbonCurve({
  seed = 1, loops = 3, height = 2.2, gap = 0.92, depth = 0.35, curl = 1,
} = {}) {
  const rng = mulberry32((seed >>> 0) || 1)
  const jit = (a) => (rng() - 0.5) * 2 * a
  const cols = Math.max(1, Math.round(loops))
  const x0 = -((cols - 1) * gap) / 2
  const h = height
  const pts = []
  let s = 0
  // gentle z-wave along arclength so the fold has 3D depth, not a flat decal
  const push = (x, y) => { pts.push(new THREE.Vector3(x, y, Math.sin(s * 1.7 + seed) * depth)); s += 1 }

  const VPC = 10 // vertical samples per column
  const APC = 24 // samples per semicircle hairpin cap
  for (let k = 0; k < cols; k++) {
    const x = x0 + k * gap + jit(gap * 0.06)
    const up = k % 2 === 0
    const yA = up ? -h / 2 : h / 2
    const yB = up ? h / 2 : -h / 2
    for (let i = 0; i < VPC; i++) push(x, yA + ((yB - yA) * i) / VPC)
    if (k < cols - 1) {
      // semicircular hairpin to the next column — bulges over the top when the
      // run went up, under the bottom when it went down (the nested-U fold).
      const xn = x0 + (k + 1) * gap
      const cx = (x + xn) / 2
      const r = (xn - x) / 2
      const dir = up ? 1 : -1
      for (let i = 0; i <= APC; i++) {
        const a = (i / APC) * Math.PI
        push(cx - Math.cos(a) * r, yB + dir * Math.sin(a) * r)
      }
    }
  }

  // Final curl: spiral the tip inward (the rolled end in the reference stills).
  if (curl > 0 && pts.length >= 2) {
    const last = pts[pts.length - 1]
    const prev = pts[pts.length - 2]
    const t = last.clone().sub(prev).setZ(0).normalize()
    const perp = new THREE.Vector3(-t.y, t.x, 0).normalize()
    const r0 = gap * 0.5
    const center = last.clone().add(perp.clone().multiplyScalar(r0))
    const ang0 = Math.atan2(last.y - center.y, last.x - center.x)
    const turns = 1.1 * curl
    const steps = 44
    for (let i = 1; i <= steps; i++) {
      const f = i / steps
      const ang = ang0 - turns * Math.PI * 2 * f
      const rr = r0 * (1 - 0.7 * f)
      pts.push(new THREE.Vector3(
        center.x + Math.cos(ang) * rr,
        center.y + Math.sin(ang) * rr,
        last.z + Math.sin(f * 3 + seed) * depth * 0.4,
      ))
    }
  }

  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  return curve
}

export function buildRibbonGeometry({
  seed = 1, loops = 3, height = 2.2, gap = 0.92, depth = 0.35, curl = 1,
  width = 0.5, ribbonThickness = 0.12, corner = 0.045,
  tubularSegments = 800, radialSegments = 48,
} = {}) {
  const curve = makeRibbonCurve({ seed, loops, height, gap, depth, curl })
  curve.arcLengthDivisions = Math.max(400, tubularSegments)
  const frames = curve.computeFrenetFrames(tubularSegments, false)
  const profile = roundedRectProfile(width / 2, ribbonThickness / 2, corner, radialSegments)
  const R = profile.length
  const stride = R + 1 // duplicate the seam vertex for clean UVs/normals

  const positions = []
  const uvs = []
  const indices = []
  const P = new THREE.Vector3()

  for (let i = 0; i <= tubularSegments; i++) {
    curve.getPointAt(i / tubularSegments, P)
    const N = frames.normals[i]
    const B = frames.binormals[i]
    for (let j = 0; j <= R; j++) {
      const pj = profile[j % R]
      positions.push(
        P.x + pj.u * B.x + pj.v * N.x,
        P.y + pj.u * B.y + pj.v * N.y,
        P.z + pj.u * B.z + pj.v * N.z,
      )
      uvs.push(i / tubularSegments, j / R)
    }
  }
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * stride + j
      const b = (i + 1) * stride + j
      const c = (i + 1) * stride + j + 1
      const d = i * stride + j + 1
      indices.push(a, b, d, b, c, d)
    }
  }

  // End caps — a fan from each end's centerline point (== profile centroid) to
  // close the solid (open ends would show hollow through the glass).
  const startC = positions.length / 3
  curve.getPointAt(0, P); positions.push(P.x, P.y, P.z); uvs.push(0, 0.5)
  const endC = positions.length / 3
  curve.getPointAt(1, P); positions.push(P.x, P.y, P.z); uvs.push(1, 0.5)
  for (let j = 0; j < R; j++) {
    indices.push(startC, j + 1, j) // start ring (ring 0)
    const base = tubularSegments * stride
    indices.push(endC, base + j, base + j + 1) // end ring
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geom.setIndex(indices)
  geom.computeVertexNormals()
  geom.computeBoundingSphere()
  // Index layout is ring-by-ring from spine start → end, then the two end caps.
  // The engine reveals [0 .. ring·ringIndexCount] to "draw on" the ribbon along
  // its own spine before rotating it.
  geom.userData = {
    tubularSegments,
    ringIndexCount: R * 6,
    bodyIndexCount: tubularSegments * R * 6,
    totalIndexCount: indices.length,
  }
  return geom
}
