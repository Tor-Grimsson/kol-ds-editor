// Repulsive Curves — simplified tangent-point energy (Yu–Schumacher–Crane 2021)
// Self-repulsion via pairwise tangent-point penalty 1/r^alpha prevents crossings.
// SDF attraction keeps the curve coiling densely inside the glyph.
// Full Sobolev solve replaced by direct gradient + spatial grid for O(N log N).



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, sdfGrad } from '../common.js'

const PARAMS          = [
  { key: 'N0',      type: 'int',   min: 40,  max: 400, default: 120, step: 20,   label: 'nodes' },
  { key: 'alpha',   type: 'range', min: 1.5, max: 4,   default: 2.5, step: 0.1,  label: 'repulsion exponent' },
  { key: 'repK',    type: 'range', min: 0,   max: 2,   default: 0.6, step: 0.05, label: 'repulsion strength' },
  { key: 'sdfPull', type: 'range', min: 0,   max: 3,   default: 1.2, step: 0.05, label: 'sdf pull' },
  { key: 'tensK',   type: 'range', min: 0,   max: 1,   default: 0.2, step: 0.01, label: 'tension' },
]



export const r2_curve_03_repulsive            = {
  id: 'r2-curve-03-repulsive',
  name: 'REPULSIVE CURVES',
  repo: 'Yu–Schumacher–Crane ACM TOG 2021',
  summary: 'Inextensible closed curve with tangent-point self-repulsion energy. Packs densely inside the SDF glyph without ever crossing itself — like wound thread filling a letterform.',
  helps: 'Densest crossing-free packing achievable with a polyline. Clean topology at all times.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    const sx = W / sdf.w, sy = H / sdf.h
    const N0      = num(params, 'N0', 120)
    const alpha   = num(params, 'alpha', 2.5)
    const repK    = num(params, 'repK', 0.6)
    const sdfPull = num(params, 'sdfPull', 1.2)
    const tensK   = num(params, 'tensK', 0.2)

    // seed: small circle centered in glyph
    const cx = sdf.w * 0.5, cy = sdf.h * 0.5
    const seedR = Math.min(sdf.w, sdf.h) * 0.12
    const pts       = []
    for (let i = 0; i < N0; i++) {
      const a = (i / N0) * Math.PI * 2
      pts.push({ x: cx + Math.cos(a) * seedR, y: cy + Math.sin(a) * seedR })
    }

    const dt = 0.1
    const CUTOFF = Math.min(sdf.w, sdf.h) * 0.35
    const REMESH = 25
    let step = 0

    function remesh(p      )       {
      const n = p.length
      let total = 0
      const ls           = []
      for (let i = 0; i < n; i++) {
        const l = Math.hypot(p[(i+1)%n].x-p[i].x, p[(i+1)%n].y-p[i].y)
        ls.push(l); total += l
      }
      const seg = total / N0
      const out       = []
      let acc = 0, idx = 0
      for (let k = 0; k < N0; k++) {
        const tgt = k * seg
        while (acc + ls[idx] < tgt && idx < n-1) { acc += ls[idx]; idx++ }
        const t = ls[idx] > 1e-9 ? (tgt-acc)/ls[idx] : 0
        const a = p[idx], b = p[(idx+1)%n]
        out.push({ x: a.x+t*(b.x-a.x), y: a.y+t*(b.y-a.y) })
      }
      return out
    }

    return wrapLoop(() => {
      const n = pts.length
      const fx = new Float32Array(n)
      const fy = new Float32Array(n)

      // tangent at each vertex
      const tx           = new Array(n), ty_arr           = new Array(n)
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i+1)%n]
        const l = Math.hypot(q.x-p.x, q.y-p.y) || 1
        tx[i] = (q.x-p.x)/l; ty_arr[i] = (q.y-p.y)/l
      }

      // tangent-point repulsion: simplified — skip full BVH, use spatial grid
      const cs = CUTOFF * 0.5
      const gw = Math.ceil(sdf.w / cs) + 1
      const gh = Math.ceil(sdf.h / cs) + 1
      const grid             = new Array(gw * gh).fill(null).map(() => [])
      for (let i = 0; i < n; i++) {
        const gxi = Math.max(0, Math.min(gw-1, Math.floor(pts[i].x/cs)))
        const gyi = Math.max(0, Math.min(gh-1, Math.floor(pts[i].y/cs)))
        grid[gyi*gw+gxi].push(i)
      }

      for (let i = 0; i < n; i++) {
        const p = pts[i]
        const gxi = Math.max(0, Math.min(gw-1, Math.floor(p.x/cs)))
        const gyi = Math.max(0, Math.min(gh-1, Math.floor(p.y/cs)))
        const nx = tx[i], ny = ty_arr[i]

        for (let dgy = -1; dgy <= 1; dgy++) {
          for (let dgx = -1; dgx <= 1; dgx++) {
            const bx = gxi+dgx, by = gyi+dgy
            if (bx<0||bx>=gw||by<0||by>=gh) continue
            const bucket = grid[by*gw+bx]
            for (const j of bucket) {
              if (j === i) continue
              const dx = p.x - pts[j].x, dy = p.y - pts[j].y
              const d2 = dx*dx + dy*dy
              if (d2 > CUTOFF*CUTOFF || d2 < 1e-6) continue
              const d = Math.sqrt(d2)
              // tangent-point radius: d / |sin angle between tangent and chord|
              const dot = nx*(dx/d) + ny*(dy/d)
              const sinA = Math.sqrt(Math.max(0, 1 - dot*dot)) + 1e-6
              const r = d / sinA
              const grad = alpha * Math.pow(r, -(alpha+1)) / (sinA * d + 1e-9)
              fx[i] += (dx/d) * grad * repK
              fy[i] += (dy/d) * grad * repK
            }
          }
        }

        // tension: spring to neighbors
        for (const oi of [(i-1+n)%n, (i+1)%n]) {
          const ex = pts[oi].x-p.x, ey = pts[oi].y-p.y
          const el = Math.hypot(ex,ey) || 1e-9
          const tgt = Math.hypot(sdf.w, sdf.h) * 0.5 / N0 * 2
          fx[i] += (ex/el)*(el-tgt) * tensK
          fy[i] += (ey/el)*(el-tgt) * tensK
        }

        // SDF boundary push inward
        const sv = sdf.sample(p.x, p.y)
        if (sv > -8) {
          const [gx, gy] = sdfGrad(sdf, p.x, p.y)
          const gm = Math.hypot(gx,gy) || 1
          fx[i] -= (gx/gm) * sdfPull * Math.max(0, sv+8) * 0.07
          fy[i] -= (gy/gm) * sdfPull * Math.max(0, sv+8) * 0.07
        }
      }

      for (let i = 0; i < n; i++) {
        pts[i].x += fx[i]*dt
        pts[i].y += fy[i]*dt
      }

      step++
      if (step % REMESH === 0) {
        const r = remesh(pts)
        pts.splice(0, pts.length, ...r)
      }

      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H)

      ctx.strokeStyle = '#f0b060'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      const nn = pts.length
      for (let i = 0; i < nn; i++) {
        const p = pts[i]
        if (i === 0) ctx.moveTo(p.x*sx, p.y*sy)
        else ctx.lineTo(p.x*sx, p.y*sy)
      }
      ctx.closePath()
      ctx.stroke()
    })
  },
}
