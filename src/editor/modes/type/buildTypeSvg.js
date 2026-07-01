/**
 * Build a self-contained SVG of the current Type Lab composition (all frames,
 * with current axis modes resolved as outline paths). Async because it has to
 * ensure fonts are loaded before extracting glyph outlines.
 *
 * Used for "Save SVG to library" and "Download SVG" — single source of truth
 * so live preview and export stay in sync.
 */

import { loadFont } from './fontLoader'
import { applyCase } from './cuts'
import { pickCutFor, seedFromBlend } from './axisRandom'
import { curveBlend } from './curveMath'

const lerp = (a, b, t) => a * (1 - t) + b * t

const ASPECT_MAP = { '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16 }
const VIRTUAL_W  = 1080

function aspectToWH(aspect, customRatio) {
  const ratio = aspect === 'custom' ? (customRatio || 1) : (ASPECT_MAP[aspect] ?? 1)
  return { w: VIRTUAL_W, h: Math.round(VIRTUAL_W / ratio) }
}

function commandsToPath(cmds) {
  const out = []
  for (const c of cmds) {
    switch (c.type) {
      case 'M': out.push(`M${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'L': out.push(`L${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'C': out.push(`C${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x2.toFixed(2)} ${c.y2.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'Q': out.push(`Q${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'Z': out.push('Z'); break
      default:  break
    }
  }
  return out.join('')
}

function commandsMatch(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i].type !== b[i].type) return false
  return true
}

/* Approximate bounding box from a path's command list. Walks every numeric
 * coordinate (control points included). Slightly overestimates curve extents
 * — exact curve hulls would extend beyond control points only on extreme
 * curves, which doesn't matter at glyph trim resolution. */
function commandsBbox(commands) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const c of commands) {
    for (const k of ['x', 'x1', 'x2']) {
      if (k in c) { x1 = Math.min(x1, c[k]); x2 = Math.max(x2, c[k]) }
    }
    for (const k of ['y', 'y1', 'y2']) {
      if (k in c) { y1 = Math.min(y1, c[k]); y2 = Math.max(y2, c[k]) }
    }
  }
  return x1 === Infinity ? { x1: 0, y1: 0, x2: 0, y2: 0 } : { x1, y1, x2, y2 }
}

function lerpCommands(a, b, t) {
  return a.map((ca, i) => {
    const cb = b[i]
    const out = { type: ca.type }
    if ('x'  in ca && 'x'  in cb) out.x  = lerp(ca.x,  cb.x,  t)
    if ('y'  in ca && 'y'  in cb) out.y  = lerp(ca.y,  cb.y,  t)
    if ('x1' in ca && 'x1' in cb) out.x1 = lerp(ca.x1, cb.x1, t)
    if ('y1' in ca && 'y1' in cb) out.y1 = lerp(ca.y1, cb.y1, t)
    if ('x2' in ca && 'x2' in cb) out.x2 = lerp(ca.x2, cb.x2, t)
    if ('y2' in ca && 'y2' in cb) out.y2 = lerp(ca.y2, cb.y2, t)
    return out
  })
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Compute alignment offset within the frame width, given total glyph width
 * and the frame's text-align value. Mirrors the live preview's CSS.
 */
function alignOffset(textAlign, frameW, totalW) {
  if (textAlign === 'left')   return 0
  if (textAlign === 'right')  return frameW - totalW
  /* center (default) */
  return (frameW - totalW) / 2
}

async function fontsForFrame(frame) {
  const a = await loadFont(frame.width,  frame.weight,  frame.italic)
  let b = a
  const mode = frame.axisMode ?? 'morph'
  if (frame.axisOn && (mode === 'morph' || mode === 'fade')) {
    b = await loadFont(frame.width2, frame.weight2, frame.italic)
  }
  return { a, b }
}

/**
 * Compute per-glyph paths + positions for a single text frame. Returns the
 * raw glyph data (path + x position + advance per character) plus the
 * frame-level alignment offset and translate. Used by `buildFrameSvg` for
 * full-frame rendering and by compose's `flattenText` to produce one shape
 * layer per glyph.
 */
export async function computeFrameGlyphs(frame) {
  const display = applyCase(frame.text, frame.case)
  const chars   = Array.from(display).filter((ch) => ch !== '\n')
  if (chars.length === 0) {
    return { glyphs: [], totalW: 0, offset: 0, tx: frame.x, ty: frame.y }
  }

  const { a, b } = await fontsForFrame(frame)
  const size  = frame.size
  const mode  = frame.axisMode ?? 'morph'
  const denom = Math.max(1, chars.length - 1)

  const glyphs = []
  let x = 0

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const t  = i / denom

    let d
    let advance
    let bbox

    if (frame.axisOn && mode === 'morph') {
      const bl = curveBlend(t, frame.axisCurve ?? 'flat', frame.blend, frame.curveCp1 ?? { x: 0.33, y: 0.33 }, frame.curveCp2 ?? { x: 0.66, y: 0.66 })
      const pA = a.getPath(ch, 0, 0, size)
      const pB = b.getPath(ch, 0, 0, size)
      const lerped = commandsMatch(pA.commands, pB.commands)
        ? lerpCommands(pA.commands, pB.commands, bl)
        : (bl < 0.5 ? pA : pB).commands
      d    = commandsToPath(lerped)
      bbox = commandsBbox(lerped)
      const advA = a.charToGlyph(ch).advanceWidth * (size / a.unitsPerEm)
      const advB = b.charToGlyph(ch).advanceWidth * (size / b.unitsPerEm)
      advance = advA * (1 - bl) + advB * bl
    } else if (frame.axisOn && mode === 'random') {
      const seed = seedFromBlend(frame.blend)
      const [w, wt] = pickCutFor(i, seed, {
        widthLock:  frame.randomWidthLock,
        weightLock: frame.randomWeightLock,
      })
      const font = await loadFont(w, wt, frame.italic)
      const path = font.getPath(ch, 0, 0, size)
      d       = path.toPathData(2)
      bbox    = path.getBoundingBox()
      advance = font.charToGlyph(ch).advanceWidth * (size / font.unitsPerEm)
    } else {
      /* No axis (or fade — snapshot the primary cut for static export). */
      const path = a.getPath(ch, 0, 0, size)
      d       = path.toPathData(2)
      bbox    = path.getBoundingBox()
      advance = a.charToGlyph(ch).advanceWidth * (size / a.unitsPerEm)
    }

    glyphs.push({ ch, d, x, advance, bbox })
    x += advance
  }

  const totalW = x
  const offset = alignOffset(frame.textAlign ?? 'center', frame.w, totalW)
  /* Glyphs are drawn baseline-relative (paths extend up from y=0). Translate
   * the group down by `size` so the cap-line sits roughly at frame.y. */
  const tx = frame.x + offset
  const ty = frame.y + size

  return { glyphs, totalW, offset, tx, ty }
}

export async function buildFrameSvg(frame) {
  const { glyphs, tx, ty } = await computeFrameGlyphs(frame)
  if (glyphs.length === 0) return ''
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)})" fill="${frame.color}" fill-rule="evenodd">
${glyphs.filter((g) => g.d).map((g) => `  <path d="${g.d}" transform="translate(${g.x.toFixed(2)} 0)"/>`).join('\n')}
</g>`
}

export async function buildTypeCompositionSvg(state) {
  const { aspect, bgColor, frames } = state
  const { w, h } = aspectToWH(aspect)

  const groups = await Promise.all(frames.map(buildFrameSvg))

  const bg = bgColor ? `<rect width="${w}" height="${h}" fill="${escapeXml(bgColor)}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${bg}
${groups.join('\n')}
</svg>`
}

export function downloadSvg(svgString, filename = 'composition.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
