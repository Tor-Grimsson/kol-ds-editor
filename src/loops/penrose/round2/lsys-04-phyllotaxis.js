// Phyllotaxis-driven L-system fill.
// Organs are placed at successive golden-angle intervals (137.5°) along an
// expanding axis, spiral unrolling one organ per frame. Each organ's radial
// length scales as |sdf(pos)| so arms near the centroid are long and arms at
// the boundary are short — the letterform silhouette emerges from physics.
//
// Reference: Fowler, Prusinkiewicz & Battjes, SIGGRAPH 1992.
//            ABOP Ch.4 (entire phyllotaxis chapter).



import { num, bool } from '../knobs.js'
import { clear, strokeOutline, wrapLoop } from '../common.js'

const GOLDEN_ANGLE = 137.507764 * (Math.PI / 180)  // radians

const PARAMS          = [
  { key: 'spawnRate',  type: 'range', min: 0.5, max: 20,  default: 6,   step: 0.5,  label: 'organs/sec' },
  { key: 'axisStep',   type: 'range', min: 0.5, max: 4,   default: 1.4, step: 0.1,  label: 'axis advance' },
  { key: 'armScale',   type: 'range', min: 0.2, max: 2,   default: 0.9, step: 0.05, label: 'arm scale' },
  { key: 'waveAmp',    type: 'range', min: 0,   max: 0.5, default: 0.1, step: 0.01, label: 'wave tropism' },
  { key: 'showAxis',   type: 'boolean', default: false, label: 'show axis' },
]












export const r2_lsys_04_phyllotaxis            = {
  id: 'r2-lsys-04-phyllotaxis',
  name: 'PHYLLOTAXIS SPIRAL FILL',
  repo: 'Fowler/Prusinkiewicz/Battjes SIGGRAPH 1992 + ABOP Ch.4',
  summary: 'Golden-angle organ placement unrolls one arm per frame; organ length scales with local SDF depth so the letterform silhouette emerges from the spiral packing.',
  helps: 'Completely different visual register from branching trees — sunflower-style radiating fill that respects the glyph without any explicit clipping logic.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params, clock }) {
    const sx = W / sdf.w, sy = H / sdf.h

    const organs          = []
    // Axis walks from centroid outward in a slow spiral path
    // axis state: position + total divergence angle
    let axisX = sdf.w / 2
    let axisY = sdf.h / 2
    let axisAngle = rng() * Math.PI * 2  // starting divergence offset
    let orgCount = 0
    let lastSpawn = clock.nowSeconds()

    return wrapLoop(() => {
      const t = clock.nowSeconds()
      const spawnRate = num(params, 'spawnRate', 6)
      const axisStep  = num(params, 'axisStep', 1.4)
      const armScale  = num(params, 'armScale', 0.9)
      const waveAmp   = num(params, 'waveAmp', 0.1)
      const showAxis  = bool(params, 'showAxis', false)

      // --- Spawn new organ ---
      const interval = 1 / spawnRate
      while (t - lastSpawn >= interval) {
        lastSpawn += interval

        // Advance axis with tiny inward correction (weak tropism toward centroid)
        const cx = sdf.w / 2, cy = sdf.h / 2
        const toCx = cx - axisX, toCy = cy - axisY
        const tm = Math.hypot(toCx, toCy) || 1
        axisX += (toCx / tm) * axisStep * 0.15
        axisY += (toCy / tm) * axisStep * 0.15
        // Wrap to stay inside
        if (sdf.sample(axisX, axisY) >= 0) {
          axisX = cx + (rng() - 0.5) * 4
          axisY = cy + (rng() - 0.5) * 4
        }

        // Golden angle divergence
        axisAngle += GOLDEN_ANGLE + (rng() - 0.5) * 0.04

        // Organ arm: radial from axis point, length = |sdf| * armScale
        const orgHeading = axisAngle + (orgCount % 2 === 0 ? 0 : Math.PI)
        const d = Math.abs(sdf.sample(axisX, axisY))
        const armLen = d * armScale * (0.7 + rng() * 0.6)
        if (armLen < 1) { orgCount++; continue }

        const tx = axisX + Math.cos(orgHeading) * armLen
        const ty = axisY + Math.sin(orgHeading) * armLen
        if (sdf.sample(tx, ty) >= 0) { orgCount++; continue }

        organs.push({
          ax: axisX, ay: axisY,
          tx, ty,
          phase: rng() * Math.PI * 2,
          armLen,
          headingOrgan: orgHeading,
        })
        orgCount++
      }

      // --- Render ---
      clear(ctx, W, H)
      strokeOutline(ctx, sdf, W, H, 'rgba(243,231,207,0.18)', 1)

      ctx.lineCap = 'round'
      for (let i = 0; i < organs.length; i++) {
        const o = organs[i]
        const age = i / Math.max(1, organs.length)

        // Wave: tip oscillates transversely over time
        const wave = waveAmp * Math.sin(t * 2.1 + o.phase)
        const perpX = -Math.sin(o.headingOrgan)
        const perpY =  Math.cos(o.headingOrgan)
        const tx = o.tx + perpX * o.armLen * wave
        const ty = o.ty + perpY * o.armLen * wave

        const hue = 200 + age * 60
        const alpha = 0.25 + 0.6 * age
        ctx.strokeStyle = `hsla(${hue},70%,75%,${alpha.toFixed(2)})`
        ctx.lineWidth = 0.8 + age * 0.8
        ctx.beginPath()
        ctx.moveTo(o.ax * sx, o.ay * sy)
        ctx.lineTo(tx * sx, ty * sy)
        ctx.stroke()
      }

      if (showAxis) {
        ctx.fillStyle = 'rgba(255,220,100,0.7)'
        ctx.beginPath()
        ctx.arc(axisX * sx, axisY * sy, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  },
}
