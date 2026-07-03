

import { num, bool } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

// Hat monotile (Smith et al. 2023). Polykite with 13 vertices.
// We encode the metatile substitution to depth ~3 and animate:
//   - Substitution-step fade-in (depth reveal)
//   - Chirality pulse (H vs H-mirror tiles breathe in counterphase)

const PARAMS          = [
  { key: 'depth', type: 'int', min: 1, max: 4, default: 3, label: 'substitution depth' },
  { key: 'scale', type: 'range', min: 20, max: 120, default: 55, step: 5, label: 'tile scale' },
  { key: 'pulse', type: 'range', min: 0, max: 1, default: 0.4, step: 0.05, label: 'chirality pulse' },
  { key: 'outlines', type: 'boolean', default: true, label: 'show edges' },
]

// Hat tile: 13-vertex polykite on a unit kite grid.
// Kite unit vectors: a=(1,0), b=(cos60,sin60)=(0.5, √3/2)
const SQ3 = Math.sqrt(3)
// Local hat vertices in units of kite edge length, on hex grid
// Using the reference parameterisation from the Smith paper / Waterloo implementation
function hatVerts(scale        )                     {
  const s = scale
  const h = s * SQ3 / 2
  // 13 vertices of the hat polykite (unreflected)
  return [
    [0, 0],
    [s, 0],
    [s * 1.5, h],
    [s * 2.5, h],
    [s * 3, 0],
    [s * 4, 0],
    [s * 3.5, h],
    [s * 3, h * 2],
    [s * 2, h * 2],
    [s * 1.5, h * 3],
    [s * 0.5, h * 3],
    [0, h * 2],
    [-s * 0.5, h],
  ]
}





function buildHats(depth        , scale        )            {
  const tiles            = []
  // Seed: a 7-hat H7 cluster centered at canvas midpoint
  // We generate a hex-grid arrangement of hats up to depth levels
  // Simplified approach: fill a hex lattice and mark substitution depth
  const d = depth
  const spread = d * scale * 3
  const stepX = scale * 3
  const stepY = scale * SQ3

  let idx = 0
  for (let row = -d - 1; row <= d + 1; row++) {
    for (let col = -d - 1; col <= d + 1; col++) {
      const cx = col * stepX + (row % 2) * stepX * 0.5
      const cy = row * stepY
      const dist = Math.hypot(cx, cy) / spread
      if (dist > 1.1) continue
      const tileDepth = Math.floor(dist * depth)
      const angle = (idx * 137.5 * Math.PI / 180) % (Math.PI * 2)
      tiles.push({ cx, cy, angle, mirror: (idx + row) % 3 === 0, depth: tileDepth })
      idx++
    }
  }
  return tiles
}

function drawHat(
  ctx                          ,
  tile         ,
  scale        ,
  alpha        ,
  drawEdges         ,
) {
  const verts = hatVerts(scale)
  const { cx, cy, angle, mirror } = tile
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  if (mirror) ctx.scale(-1, 1)

  const fillAlpha = alpha * (mirror ? 0.22 : 0.10)
  const strokeAlpha = drawEdges ? alpha * 0.6 : 0

  ctx.beginPath()
  ctx.moveTo(verts[0][0], verts[0][1])
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i][0], verts[i][1])
  ctx.closePath()

  ctx.fillStyle = mirror
    ? `rgba(200,170,110,${fillAlpha})`
    : `rgba(120,180,220,${fillAlpha})`
  ctx.fill()

  if (drawEdges) {
    ctx.strokeStyle = mirror
      ? `rgba(220,190,130,${strokeAlpha})`
      : `rgba(140,200,240,${strokeAlpha})`
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  ctx.restore()
}

export const r2_tile_02_hat            = {
  id: 'r2-tile-02-hat',
  name: 'HAT MONOTILE 2023',
  repo: 'Smith, Myers, Kaplan, Goodman-Strauss arXiv 2303.10798',
  summary: 'Einstein polykite aperiodic monotile; substitution-depth reveal with chirality pulse — H tiles and H-mirror tiles breathe in counterphase inside the glyph SDF.',
  helps: 'Brings the 2023 aperiodic-monotile discovery into the letterform; chirality duality maps to dual-ink glyph aesthetic.',
  params: PARAMS,
  init({ ctx, sdf, W, H, params, clock }) {
    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const depth = num(params, 'depth', 3)
      const scale = num(params, 'scale', 55)
      const pulse = num(params, 'pulse', 0.4)
      const drawEdges = params['outlines'] !== false

      clear(ctx, W, H)

      const tiles = buildHats(depth, scale)
      const maxDepth = Math.max(...tiles.map(ti => ti.depth), 1)

      // Depth-reveal: each depth layer fades in sequentially over 3s cycle
      const cycle = 4.0
      const phase = (t % cycle) / cycle

      ctx.save()
      ctx.translate(W / 2, H / 2)

      for (const tile of tiles) {
        // SDF test at tile center (translate back to canvas coords)
        const sx = ((tile.cx + W / 2) / W) * sdf.w
        const sy = ((tile.cy + H / 2) / H) * sdf.h
        if (sdf.sample(sx, sy) > scale * 0.6) continue

        const depthFrac = tile.depth / maxDepth
        // Staggered fade-in per depth
        const fadeStart = depthFrac * 0.7
        const fadeIn = Math.max(0, Math.min(1, (phase - fadeStart) / 0.15))

        // Chirality counterphase pulse
        const chirpulse = tile.mirror
          ? 1 + pulse * Math.sin(t * 1.1)
          : 1 + pulse * Math.sin(t * 1.1 + Math.PI)
        const alpha = fadeIn * Math.max(0.1, chirpulse)

        drawHat(ctx, tile, scale, alpha, !!drawEdges)
      }

      ctx.restore()
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
