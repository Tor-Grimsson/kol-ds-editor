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
/* Path-command serializers shared with the kinetic morph engine (identical
 * copies unified — morph.js is the export). */
import { commandsToPath, commandsMatch, lerpCommands, commandsBbox } from '../../../kinetic/morph.js'

const ASPECT_MAP = { '1:1': 1, '4:5': 4 / 5, '9:16': 9 / 16 }
const VIRTUAL_W  = 1080

function aspectToWH(aspect, customRatio) {
  const ratio = aspect === 'custom' ? (customRatio || 1) : (ASPECT_MAP[aspect] ?? 1)
  return { w: VIRTUAL_W, h: Math.round(VIRTUAL_W / ratio) }
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
 * raw glyph data (path + frame-local x/y position + advance per character)
 * plus the frame translate. Used by `buildFrameSvg` for full-frame rendering
 * and by compose's `flattenText` to produce one shape layer per glyph.
 *
 * Layout mirrors the live render (TypeFrame / TypeBlock) with the same math
 * as textOutline.js — hard \n line breaks, letter-spacing in em after every
 * glyph (CSS behavior), per-line alignment over frame.w, baselines via the
 * CSS half-leading model over the primary cut's hhea metrics. It stays
 * per-glyph here (textOutline draws whole lines) because the axis modes
 * need a path per character. Lab frames carry no `h` (auto-height div) so
 * the block top-anchors; compose layers flex-center within layer.h. Each
 * line's alignment is folded into its glyphs' `x`; `offset` stays in the
 * return shape (always 0 now) for flattenText's `offset + g.x`.
 */
export async function computeFrameGlyphs(frame) {
  const display  = applyCase(frame.text, frame.case)
  const drawable = Array.from(display).filter((ch) => ch !== '\n').length
  if (drawable === 0) {
    return { glyphs: [], totalW: 0, offset: 0, tx: frame.x, ty: frame.y }
  }

  const { a, b } = await fontsForFrame(frame)
  const size    = frame.size
  const mode    = frame.axisMode ?? 'morph'
  const trackPx = (frame.tracking ?? -0.01) * size
  const denom   = Math.max(1, drawable - 1)

  /* Line metrics — textOutline.js's half-leading model. */
  const emScale = size / a.unitsPerEm
  const ascent  = a.ascender * emScale
  const descent = -a.descender * emScale         /* hhea descender is negative */
  const lineH   = (frame.lineHeight ?? 1.05) * size
  const lines   = display.split('\n')
  const blockH  = Math.max(lines.length * lineH, size)   /* min-height: 1em */
  const top     = ((frame.h ?? blockH) - blockH) / 2

  const glyphs = []
  let totalW = 0
  let gi = 0   /* index over raw chars incl. \n — the live random mode indexes these */
  let mi = 0   /* index over drawable chars — the live morph distributes blend over these */

  for (let li = 0; li < lines.length; li++) {
    const chars = Array.from(lines[li])
    const baseY = top + li * lineH + (lineH - (ascent + descent)) / 2 + ascent
    const lineGlyphs = []
    let x = 0

    for (const ch of chars) {
      const t = mi / denom

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
        advance = advA * (1 - bl) + advB * bl + trackPx
      } else if (frame.axisOn && mode === 'random') {
        const seed = seedFromBlend(frame.blend)
        const [w, wt] = pickCutFor(gi, seed, {
          widthLock:  frame.randomWidthLock,
          weightLock: frame.randomWeightLock,
        })
        const font = await loadFont(w, wt, frame.italic)
        const path = font.getPath(ch, 0, 0, size)
        d       = path.toPathData(2)
        bbox    = path.getBoundingBox()
        advance = font.charToGlyph(ch).advanceWidth * (size / font.unitsPerEm) + trackPx
      } else {
        /* No axis (or fade — snapshot the primary cut for static export). */
        const path = a.getPath(ch, 0, 0, size)
        d       = path.toPathData(2)
        bbox    = path.getBoundingBox()
        advance = a.charToGlyph(ch).advanceWidth * (size / a.unitsPerEm) + trackPx
      }

      lineGlyphs.push({ ch, d, x, y: baseY, advance, bbox })
      x += advance
      gi += 1
      mi += 1
    }
    gi += 1   /* the \n consumed between lines */

    /* Trailing whitespace hangs (pre-wrap) — excluded from the measured
     * line width, like textOutline's measure(). */
    let lineW = x
    for (let j = lineGlyphs.length - 1; j >= 0 && /\s/.test(lineGlyphs[j].ch); j--) lineW -= lineGlyphs[j].advance
    const lx = alignOffset(frame.textAlign ?? 'center', frame.w, lineW)
    for (const g of lineGlyphs) g.x += lx
    glyphs.push(...lineGlyphs)
    totalW = Math.max(totalW, lineW)
  }

  return { glyphs, totalW, offset: 0, tx: frame.x, ty: frame.y }
}

export async function buildFrameSvg(frame) {
  const { glyphs, tx, ty } = await computeFrameGlyphs(frame)
  if (glyphs.length === 0) return ''
  return `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)})" fill="${frame.color}" fill-rule="evenodd">
${glyphs.filter((g) => g.d).map((g) => `  <path d="${g.d}" transform="translate(${g.x.toFixed(2)} ${g.y.toFixed(2)})"/>`).join('\n')}
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
