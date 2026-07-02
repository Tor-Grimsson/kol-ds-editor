import { TAU } from '../../lib/util.js'

// Stripes — VECTOR bands (a handful of fillRects), NOT per-pixel. Transform into a
// stripe-local frame (camera angle + zoom, then the stripe angle) and fill one rect
// per visible band; canvas anti-aliases edges + sub-pixel motion. Palette:
// color/color2/color3 = bands, bg = ground for pinstripes.
//   duty >= 1 → solid bands (edgeSoftness ⇒ per-band ombré gradient)
//   duty <  1 → ink band of width `duty` on the bg ground (pinstripe / slats)
//
// Two motion layers, both seamless:
//   FRAME — the whole field scrolls (camFlow, whole periods) + static Offset.
//   FORM  — each band moves INDIVIDUALLY: Sway shifts a band, Stagger phases the
//           sway across band index (×π ⇒ odd/even bands move opposite at 1), and
//           Colour shimmers per band. Bands are drawn edge-to-edge so a per-band
//           shift widens one gap and narrows the next — no overlaps.
export function drawStripes(ctx, u, w, h, p) {
  const cols = [p.color, p.color2 || p.color, p.color3 || p.color2 || p.color]
  const bands = Math.max(1, Math.round(p.bandCount || 2))
  const pitch = Math.max(2, p.stripePitch || 60)
  const duty = p.duty == null ? 1 : p.duty
  const soft = p.edgeSoftness || 0
  const z = p.camZoom || 1
  const split = p.panDir === 'split'
  const dir = (p.panDir === 'left' || p.panDir === 'up' || p.panDir === 'anti') ? -1 : 1
  // Frame scroll (whole periods/loop ⇒ seamless) + static cross-band Offset X. Split
  // applies the scroll per-band by parity instead of uniformly (see below).
  const scroll = u * Math.round(p.camFlow || 0) * bands
  const drift = (split ? 0 : scroll * dir) + (p.offsetX || 0) * bands
  // Per-band Form (seamless on whole fieldCycles). `bandPhase(n)` carries the
  // Stagger so each band's Sway + Colour are individually phased.
  const tphase = u * TAU * Math.round(p.fieldCycles || 1)
  const stag = (p.fieldStagger || 0) * Math.PI
  const sway = (p.fieldSway || 0) * pitch * 0.5
  // Per-band phase keyed to the COLOUR index (n mod bands) so the per-band Form
  // (Sway/Stagger) stays seamless even while the Frame drifts the whole field by
  // whole colour-periods. Stagger=1 ⇒ adjacent bands a half-cycle apart (odd/even).
  const bandPhase = (n) => tphase - (((n % bands) + bands) % bands) * stag
  const edge = (n) => (n - drift) * pitch + sway * Math.sin(bandPhase(n)) // shared boundary

  // Split opens gaps between the counter-marching bands. `fillMode` decides what fills
  // them: 'off' = ground (p.bg) shows · 'solid' = a chosen colour fills the ground ·
  // 'extend' = each band stretches to meet its neighbour (handled per-band below).
  if (split && p.fillMode === 'solid') { ctx.fillStyle = p.fillColor || p.bg; ctx.fillRect(0, 0, w, h) }

  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate((p.camAngle || 0) * Math.PI / 180)
  ctx.scale(z, z)
  ctx.rotate((p.stripeAngle || 0) * Math.PI / 180) // stripe-local: x = band normal
  ctx.translate(0, (p.offsetY || 0) * pitch * bands) // Offset Y: shift along the bands

  const reach = (Math.hypot(w, h) / 2) / z + pitch * 2
  const y0 = -reach, yH = reach * 2

  // Optional wave: when Amplitude > 0 the bands undulate along their length, so Travel
  // (waveFlow) can run that wave along. `paintBand` draws a band of width `bw` at left
  // edge x0 — a wavy vector strip when amp>0, else a cheap rect. Used by every path
  // below (incl. Split), so the wave is honoured no matter the Direction.
  const waveAmp = p.waveAmp || 0
  const wFreq = p.waveFreq == null ? 1.5 : p.waveFreq
  const wk = (TAU * wFreq) / (reach * 2)
  const wstep = Math.max(4, (reach * 2) / 72)
  const wavePhase = u * TAU * Math.round(p.waveFlow || 0) * dir // along-axis Travel (whole cycles ⇒ seamless)
  const wAmp = waveAmp * pitch
  const wy = (y) => wAmp * Math.sin(wk * y + wavePhase)
  const paintBand = (x0, bw, col) => {
    ctx.fillStyle = col
    if (waveAmp > 0) {
      ctx.beginPath()
      ctx.moveTo(x0 + wy(-reach), -reach)
      for (let y = -reach; y <= reach; y += wstep) ctx.lineTo(x0 + wy(y), y)
      for (let y = reach; y >= -reach; y -= wstep) ctx.lineTo(x0 + bw + wy(y), y)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.fillRect(x0, y0, bw, yH)
    }
  }

  if (split) {
    // Counter-march: odd vs even bands travel in OPPOSITE directions (whole
    // colour-periods/loop ⇒ seamless). Independent strips, so the two combs slide
    // past each other (overlap one side, ground/extend shows the other).
    const ext = Math.round(p.camFlow || 0) * bands + 2 // max shift over the loop (constant ⇒ stable range)
    const lo = Math.floor(-reach / pitch) - 2 - ext, hi = Math.ceil(reach / pitch) + 2 + ext
    if (p.fillMode === 'extend') { // static abutting base ⇒ gaps reveal the pattern behind
      for (let n = lo; n <= hi; n++) paintBand((n - drift) * pitch, pitch, cols[((n % bands) + bands) % bands])
    }
    for (let n = lo; n <= hi; n++) {
      const x = (n - drift - (n & 1 ? -1 : 1) * scroll) * pitch + sway * Math.sin(bandPhase(n))
      paintBand(x, duty < 0.999 ? pitch * duty : pitch, cols[((n % bands) + bands) % bands])
    }
    ctx.restore()
    return
  }

  if (waveAmp > 0) {
    const lo = Math.floor(-reach / pitch + drift) - 2, hi = Math.ceil(reach / pitch + drift) + 2
    for (let n = lo; n <= hi; n++) paintBand(edge(n), duty < 0.999 ? pitch * duty : pitch, cols[((n % bands) + bands) % bands])
    ctx.restore()
    return
  }

  const nLo = Math.floor(-reach / pitch + drift) - 2
  const nHi = Math.ceil(reach / pitch + drift) + 2
  for (let n = nLo; n <= nHi; n++) {
    const idx = ((n % bands) + bands) % bands
    const x0 = edge(n), x1 = edge(n + 1)
    const wBand = x1 - x0
    if (wBand <= 0) continue
    const col = cols[idx]
    if (duty < 0.999 && soft <= 0) {
      ctx.fillStyle = col
      ctx.fillRect(x0, y0, wBand * duty, yH) // ink band on the (already-filled) bg
    } else if (soft > 0) {
      const g = ctx.createLinearGradient(x0, 0, x0 + wBand, 0)
      g.addColorStop(0, col)
      g.addColorStop(1, cols[(idx + 1) % bands])
      ctx.fillStyle = g
      ctx.fillRect(x0, y0, wBand, yH)
    } else {
      ctx.fillStyle = col
      ctx.fillRect(x0, y0, wBand, yH)
    }
  }
  ctx.restore()
}
