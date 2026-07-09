/**
 * Dither — full port of kol-labs-single radar/effects/ditherEngine.js (the
 * HALFTONE trio's Dither page; unrelated to the reaction-diffusion 'dither'
 * filter). The image is resampled on a cell grid; every cell draws one shape
 * from a 21-strong library, sized/rotated/offset by its luma through one of
 * 23 modes (halftone, glitch, flow field, crosshatch, CRT scanline, …).
 *
 * Amount is the labs dry/wet dial (photo crossfaded back over the cells);
 * motion is the STACKED sweep rig (sweeps.js, `params.sweeps` array with the
 * labs one-click presets). One deliberate deviation: the labs' Math.random()
 * modes (random size/rot, jitter, bio, eraser) rerolled every render — under
 * the editor's transport that strobes at 60fps, so they use a deterministic
 * per-cell hash instead (stable stills, still animatable via sweeps).
 */
import { AMOUNT_PARAM, mixSourceOver, buffersFor, sinHash2 as cellRand } from './fxCore.js'
import { NO_SWEEP, sweepStates, evalSweeps, anyReveal } from './sweeps.js'

const TAU = Math.PI * 2

/* cellRand: deterministic per-cell "random" (see header) — fxCore's sinHash2. */

/* ── shape library (labs originals) ─────────────────────────────────── */
function drawPoly(ctx, x, y, rad, sides, offset) {
  const step = TAU / sides
  for (let i = 0; i < sides; i++) {
    const ang = i * step + offset
    i === 0
      ? ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad)
      : ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad)
  }
  ctx.closePath()
}

function drawStar(ctx, cx, cy, spikes, outer, inner) {
  let rot = (Math.PI / 2) * 3
  const step = Math.PI / spikes
  ctx.moveTo(cx, cy - outer)
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outer
    let y = cy + Math.sin(rot) * outer
    ctx.lineTo(x, y)
    rot += step
    x = cx + Math.cos(rot) * inner
    y = cy + Math.sin(rot) * inner
    ctx.lineTo(x, y)
    rot += step
  }
  ctx.lineTo(cx, cy - outer)
  ctx.closePath()
}

function drawShape(ctx, x, y, size, type) {
  const r = size / 2
  ctx.beginPath()
  switch (type) {
    case 'circle': ctx.arc(x, y, r, 0, TAU); ctx.fill(); break
    case 'rect': ctx.rect(x - r, y - r, size, size); ctx.fill(); break
    case 'triangle': ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath(); ctx.fill(); break
    case 'octagon': drawPoly(ctx, x, y, r, 8, Math.PI / 8); ctx.fill(); break
    case 'star': drawStar(ctx, x, y, 5, r, r * 0.4); ctx.fill(); break
    case 'cross': { const w = r / 3; ctx.rect(x - w, y - r, w * 2, size); ctx.rect(x - r, y - w, size, w * 2); ctx.fill(); break }
    case 'rect_v': ctx.rect(x - r * 0.3, y - r, size * 0.3, size); ctx.fill(); break
    case 'rect_h': ctx.rect(x - r, y - r * 0.3, size, size * 0.3); ctx.fill(); break
    case 'hex_v': drawPoly(ctx, x, y, r, 6, Math.PI / 6); ctx.fill(); break
    case 'line_diag_r': ctx.moveTo(x - r, y + r); ctx.lineTo(x - r + size * 0.2, y + r); ctx.lineTo(x + r, y - r); ctx.lineTo(x + r - size * 0.2, y - r); ctx.closePath(); ctx.fill(); break
    case 'line_diag_l': ctx.moveTo(x - r, y - r); ctx.lineTo(x - r + size * 0.2, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x + r - size * 0.2, y + r); ctx.closePath(); ctx.fill(); break
    case 'chevron': { const chW = r * 0.4; ctx.moveTo(x - r, y + r * 0.5); ctx.lineTo(x, y - r * 0.5); ctx.lineTo(x + r, y + r * 0.5); ctx.lineTo(x + r, y + r * 0.5 - chW); ctx.lineTo(x, y - r * 0.5 - chW); ctx.lineTo(x - r, y + r * 0.5 - chW); ctx.closePath(); ctx.fill(); break }
    case 'trapezoid': ctx.moveTo(x - r * 0.6, y - r); ctx.lineTo(x + r * 0.6, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath(); ctx.fill(); break
    case 'semi_top': ctx.arc(x, y + r * 0.1, r, Math.PI, 0); ctx.closePath(); ctx.fill(); break
    case 'semi_bottom': ctx.arc(x, y - r * 0.1, r, 0, Math.PI); ctx.closePath(); ctx.fill(); break
    case 'rect_hollow': ctx.rect(x - r, y - r, size, size); ctx.rect(x + r * 0.5, y - r * 0.5, -size * 0.5, size * 0.5); ctx.fill(); break
    case 'spiral': {
      ctx.lineWidth = size * 0.15; ctx.lineCap = 'round'
      const loops = 2; const increment = r / (loops * 10)
      ctx.moveTo(x, y)
      for (let i = 0; i < loops * 20; i++) {
        const angle = 0.5 * i; const dist = increment * i
        ctx.lineTo(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist)
      }
      ctx.stroke(); break
    }
    case 'concentric':
      ctx.arc(x, y, r, 0, TAU); ctx.arc(x, y, r * 0.7, 0, TAU, true)
      ctx.arc(x, y, r * 0.4, 0, TAU); ctx.arc(x, y, r * 0.15, 0, TAU, true); ctx.fill(); break
    case 'gear': {
      const teeth = 8; const outerR = r; const innerR = r * 0.7; const holeR = r * 0.3
      for (let i = 0; i < teeth * 2; i++) {
        const a = (TAU * i) / (teeth * 2); const rad = i % 2 === 0 ? outerR : innerR
        const px = x + Math.cos(a) * rad; const py = y + Math.sin(a) * rad
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      ctx.closePath(); ctx.moveTo(x + holeR, y); ctx.arc(x, y, holeR, 0, TAU, true); ctx.fill(); break
    }
    case 'flower': {
      for (let i = 0; i < 5; i++) {
        const a = (TAU * i) / 5; const px = x + Math.cos(a) * (r * 0.6); const py = y + Math.sin(a) * (r * 0.6)
        ctx.moveTo(x, y); ctx.arc(px, py, r * 0.4, 0, TAU)
      }
      ctx.fill(); break
    }
    case 'ghost': {
      ctx.arc(x, y - r * 0.2, r * 0.8, Math.PI, 0); ctx.lineTo(x + r * 0.8, y + r); ctx.lineTo(x + r * 0.4, y + r * 0.7)
      ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.4, y + r * 0.7); ctx.lineTo(x - r * 0.8, y + r); ctx.closePath()
      ctx.moveTo(x - r * 0.3, y - r * 0.2); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.2, 0, TAU)
      ctx.moveTo(x + r * 0.3, y - r * 0.2); ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.2, 0, TAU); ctx.fill(); break
    }
    default: ctx.arc(x, y, r, 0, TAU); ctx.fill(); break
  }
}

/* ── options (labs originals, sentence-cased) ───────────────────────── */
const MODE_OPTIONS = [
  { value: 'halftone', label: 'Halftone' },
  { value: 'inv_halftone', label: 'Inverse halftone' },
  { value: 'flat', label: 'Static (flat)' },
  { value: 'stretch_v', label: 'Stretch vertical' },
  { value: 'stretch_h', label: 'Stretch horizontal' },
  { value: 'checker', label: 'Checkerboard' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'melt', label: 'Pixel melt' },
  { value: 'crosshatch', label: 'Crosshatch' },
  { value: 'rotation', label: 'Rotation' },
  { value: 'random_size', label: 'Random size' },
  { value: 'random_rot', label: 'Random rotation' },
  { value: 'opacity', label: 'Opacity' },
  { value: 'inv_opacity', label: 'Inverse opacity' },
  { value: 'threshold', label: 'Threshold' },
  { value: 'flow', label: 'Flow field' },
  { value: 'edges', label: 'Edge detect' },
  { value: 'jitter', label: 'Mosaic jitter' },
  { value: 'posterize', label: 'Posterize' },
  { value: 'interference', label: 'Interference' },
  { value: 'crt_scan', label: 'CRT scanline' },
  { value: 'bio', label: 'Bio-organic' },
  { value: 'eraser', label: 'Eraser' },
]

const SHAPE_OPTIONS = [
  { value: 'circle', label: 'Circle' },
  { value: 'rect', label: 'Square' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'octagon', label: 'Octagon' },
  { value: 'star', label: 'Star' },
  { value: 'cross', label: 'Cross' },
  { value: 'rect_v', label: 'Rect vertical' },
  { value: 'rect_h', label: 'Rect horizontal' },
  { value: 'hex_v', label: 'Hexagon' },
  { value: 'line_diag_r', label: 'Diagonal /' },
  { value: 'line_diag_l', label: 'Diagonal \\' },
  { value: 'chevron', label: 'Chevron' },
  { value: 'trapezoid', label: 'Trapezoid' },
  { value: 'semi_top', label: 'Semi-circle top' },
  { value: 'semi_bottom', label: 'Semi-circle bottom' },
  { value: 'rect_hollow', label: 'Square hollow' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'concentric', label: 'Concentric' },
  { value: 'gear', label: 'Gear' },
  { value: 'flower', label: 'Flower' },
  { value: 'ghost', label: 'Pacman ghost' },
]

/* Modes whose formula actually reads Intensity — the slider gates on these. */
const INTENSITY_MODES = new Set(['glitch', 'flow', 'edges', 'melt', 'jitter', 'interference', 'crt_scan', 'eraser'])

export default {
  id: 'fx-halftone-dither',
  label: 'Dither',
  animated: true,
  sweeps: true,   /* stacked sweep rig (sweeps.js) — Effects panel Motion tab */
  params: [
    { ...AMOUNT_PARAM, section: 'Effect' },
    { key: 'mode', label: 'Mode', type: 'select', options: MODE_OPTIONS, default: 'halftone', section: 'Mode' },
    { key: 'shape', label: 'Shape', type: 'select', options: SHAPE_OPTIONS, default: 'circle', section: 'Shape' },
    /* noRandom: cell size is grid resolution — a size thing, not a look. */
    { key: 'cellSize', label: 'Cell size', type: 'range', min: 4, max: 40, step: 1, default: 10, noRandom: true, section: 'Dither' },
    { key: 'baseScale', label: 'Scale', type: 'range', min: 0.1, max: 3, step: 0.025, default: 0.9, section: 'Dither' },
    { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 20, step: 0.25, default: 1, section: 'Dither' },
    { key: 'contrast', label: 'Contrast', type: 'range', min: -100, max: 100, step: 1, default: 0, section: 'Dither' },
    { key: 'intensity', label: 'Intensity', type: 'range', min: 0, max: 5, step: 0.05, default: 1, section: 'Dither', when: (l) => INTENSITY_MODES.has(l.mode ?? 'halftone') },
    { key: 'useColor', label: 'Original color', type: 'toggle', default: true, section: 'Color' },
    { key: 'monoColor', label: 'Foreground', type: 'color', role: 'fg', default: '#ffffff', section: 'Color', when: (l) => !(l.useColor ?? true) },
    { key: 'bgColor', label: 'Background', type: 'color', role: 'bg', default: '#111111', section: 'Color' },
  ],
  apply(ctx, src, w, h, p, u) {
    if ((p.amount ?? 100) <= 0) { ctx.drawImage(src, 0, 0, w, h); return }
    const sw = src.width
    const sh = src.height
    const data = buffersFor(src).base.data // shared per-source cache (fxCore)
    /* The source is dpr-backed (sw = w·dpr); cellSize/gap are authored in css
     * px, so scale them into source-pixel space (k = 1 at dpr 1 — identical). */
    const k = sw / w || 1
    const step = Math.max(2, Math.round((p.cellSize ?? 10) * k))
    const mode = p.mode ?? 'halftone'
    const shape = p.shape ?? 'circle'
    const baseScale = p.baseScale ?? 0.9
    const gap = (p.gap ?? 1) * k
    const intensity = p.intensity ?? 1
    const useColor = p.useColor ?? true

    const st = sweepStates(p, u)
    const reveal = anyReveal(st)

    const contrast = p.contrast ?? 0
    const cf = (259 * (contrast + 255)) / (255 * (259 - contrast))

    // Mono color → rgb components (alpha rides per-cell for the opacity modes)
    const hex = (p.monoColor ?? '#ffffff').replace(/^#/, '')
    const mR = parseInt(hex.substring(0, 2), 16)
    const mG = parseInt(hex.substring(2, 4), 16)
    const mB = parseInt(hex.substring(4, 6), 16)

    ctx.save()
    ctx.scale(w / sw, h / sh) // cell pass runs in source-pixel space
    ctx.fillStyle = p.bgColor ?? '#111111'
    ctx.fillRect(0, 0, sw, sh)
    // Reveal sweeps wipe the effect in/out over the raw photo underneath.
    if (reveal) ctx.drawImage(src, 0, 0, sw, sh)

    const size = Math.max(0, step - gap)

    for (let y = 0; y < sh; y += step) {
      for (let x = 0; x < sw; x += step) {
        const pIdx = ((y + (step >> 1)) * sw + (x + (step >> 1))) << 2
        if (pIdx >= data.length) continue

        let r = data[pIdx]
        let g = data[pIdx + 1]
        let b = data[pIdx + 2]
        const a = data[pIdx + 3]
        if (a < 20) continue // transparent cell (letterbox) — background shows

        r = Math.max(0, Math.min(255, cf * (r - 128) + 128))
        g = Math.max(0, Math.min(255, cf * (g - 128) + 128))
        b = Math.max(0, Math.min(255, cf * (b - 128) + 128))

        const pkt = st ? evalSweeps(st, (x + step / 2) / sw, (y + step / 2) / sh) : NO_SWEEP
        if (pkt.hasReveal && pkt.reveal < 0.5) continue // photo underlay shows through

        let luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        if (pkt.bright) luma = Math.max(0, Math.min(1, luma + pkt.bright))

        let scX = baseScale
        let scY = baseScale
        let rot = 0
        let offX = 0
        let offY = 0
        let alpha = 1.0

        switch (mode) {
          case 'flat': break
          case 'halftone': scX = scY = luma * baseScale * 1.5; break
          case 'inv_halftone': scX = scY = (1.0 - luma) * baseScale * 1.5; break
          case 'rotation': rot = luma * Math.PI; break
          case 'random_size': scX = scY = cellRand(x, y) * baseScale; break
          case 'random_rot': rot = cellRand(x, y) * TAU; break
          case 'glitch': offX = (luma - 0.5) * step * 1.5 * intensity; break
          case 'opacity': alpha = luma; break
          case 'inv_opacity': alpha = 1.0 - luma; break
          case 'threshold': if (luma < 0.5) scX = scY = 0; break
          case 'crosshatch':
            rot = luma > 0.5 ? Math.PI / 4 : -Math.PI / 4
            scY = baseScale * 1.5; scX = baseScale * 0.2; break
          case 'stretch_v': scX = baseScale * 0.5; scY = luma * baseScale * 3; break
          case 'stretch_h': scX = luma * baseScale * 3; scY = baseScale * 0.5; break
          case 'flow': {
            const iR = pIdx + (step << 2)
            const iB = pIdx + ((sw * step) << 2)
            const rR = data[iR] || 0, gR = data[iR + 1] || 0, bR = data[iR + 2] || 0
            const rB = data[iB] || 0, gB = data[iB + 1] || 0, bB = data[iB + 2] || 0
            const lR = (0.299 * rR + 0.587 * gR + 0.114 * bR) / 255
            const lB = (0.299 * rB + 0.587 * gB + 0.114 * bB) / 255
            const rawLuma = (0.299 * data[pIdx] + 0.587 * data[pIdx + 1] + 0.114 * data[pIdx + 2]) / 255
            const dx = lR - rawLuma
            const dy = lB - rawLuma
            rot = Math.atan2(dy, dx) * intensity
            scX = scY = luma * baseScale * 1.2; break
          }
          case 'edges': {
            const idxNext = pIdx + (step << 2)
            let rN = data[idxNext] || 0
            rN = cf * (rN - 128) + 128
            const gN = data[idxNext + 1] || 0, bN = data[idxNext + 2] || 0
            const lumaN = (0.299 * rN + 0.587 * gN + 0.114 * bN) / 255
            const diff = Math.abs(luma - lumaN)
            scX = scY = diff * 5 * baseScale * intensity; break
          }
          case 'melt':
            offY = luma * step * 2 * intensity
            scX = scY = luma * baseScale; break
          case 'jitter': {
            const jit = (cellRand(x, y) - 0.5) * step * 2
            if (luma > 0.5) { offX = jit * intensity; offY = jit * intensity }
            scX = scY = luma * baseScale; break
          }
          case 'checker': {
            const gridX = Math.floor(x / step)
            const gridY = Math.floor(y / step)
            scX = scY = (gridX + gridY) % 2 === 0
              ? luma * baseScale * 1.5
              : (1.0 - luma) * baseScale * 1.5; break
          }
          case 'posterize': {
            let level = 0.2
            if (luma > 0.3) level = 0.5
            if (luma > 0.6) level = 0.8
            if (luma > 0.8) level = 1.0
            scX = scY = level * baseScale; break
          }
          case 'interference': {
            const pattern = Math.sin((x * y) * 0.0001 * intensity)
            scX = scY = (luma + pattern) * 0.5 * baseScale * 1.5; break
          }
          case 'crt_scan': {
            const line = Math.floor(y / step)
            if (line % 2 === 0) {
              scX = baseScale * 1.2; scY = baseScale * 0.2; offX = 2 * intensity
            } else {
              scX = luma * baseScale; scY = baseScale * 0.8
            }; break
          }
          case 'bio':
            rot = Math.sin(luma * TAU) + cellRand(x, y) * 0.5
            scX = scY = (luma + 0.2) * baseScale; break
          case 'eraser':
            if (cellRand(x, y) > luma * intensity) scX = scY = 0; break
        }

        ctx.save()
        ctx.translate(x + step / 2 + offX + pkt.offX * step, y + step / 2 + offY + pkt.offY * step)
        ctx.rotate(rot + pkt.rot)
        ctx.scale(scX * pkt.scaleMul, scY * pkt.scaleMul)
        ctx.fillStyle = useColor
          ? `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${alpha})`
          : `rgba(${mR},${mG},${mB},${alpha})`
        ctx.strokeStyle = ctx.fillStyle
        drawShape(ctx, 0, 0, size, shape)
        ctx.restore()
      }
    }
    ctx.restore()
    mixSourceOver(ctx, src, w, h, p.amount) // dry/wet: photo back over the cells
  },
}
