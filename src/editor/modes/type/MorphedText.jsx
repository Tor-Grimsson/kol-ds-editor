import { useEffect, useState } from 'react'
import { loadFont } from './fontLoader'

/**
 * Real glyph morphing — extracts outlines from two ttf fonts via opentype.js
 * (woff2 was pre-converted to ttf at build time), then interpolates the path
 * commands directly. For most letter pairs across Right Grotesk cuts the
 * command sequences match exactly (same glyph design, different proportions),
 * so we can lerp control points one-for-one and Béziers stay smooth.
 *
 * When the command sequences differ (different curve counts), we pop to the
 * closer cut at blend=0.5. flubber-style resampling tangled compound glyphs
 * (counters in O / A / B got filled in) so we avoid it.
 *
 * Loading: while fonts haven't resolved, falls back to a regular text render
 * so layout doesn't pop blank.
 */

import { curveBlend } from './curveMath'

const FALLBACK_VIEWBOX_PAD = 0.15

const lerp = (a, b, t) => a * (1 - t) + b * t

function commandsToPath(cmds) {
  const out = []
  for (const c of cmds) {
    switch (c.type) {
      case 'M': out.push(`M${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'L': out.push(`L${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'C': out.push(`C${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x2.toFixed(2)} ${c.y2.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'Q': out.push(`Q${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`); break
      case 'Z': out.push('Z'); break
      default: break
    }
  }
  return out.join('')
}

/**
 * Two command arrays match structurally if they have the same length and
 * the same type at every index. Same-letter glyphs across Right Grotesk
 * cuts almost always satisfy this; different fonts often don't.
 */
function commandsMatch(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i].type !== b[i].type) return false
  }
  return true
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

function buildGlyphData(fonts, text, blend, size, curve, cp1, cp2) {
  const { a, b } = fonts
  const glyphs = []
  let x = 0
  const chars = Array.from(text).filter((ch) => ch !== '\n')
  const denom = Math.max(1, chars.length - 1)

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const t  = i / denom                                    // position in text [0..1]
    const bl = curveBlend(t, curve, blend, cp1, cp2)        // per-char blend
    const pathA = a.getPath(ch, 0, 0, size)
    const pathB = b.getPath(ch, 0, 0, size)

    let d
    if (commandsMatch(pathA.commands, pathB.commands)) {
      d = commandsToPath(lerpCommands(pathA.commands, pathB.commands, bl))
    } else {
      d = (bl < 0.5 ? pathA : pathB).toPathData(2)
    }

    const advanceA = a.charToGlyph(ch).advanceWidth * (size / a.unitsPerEm)
    const advanceB = b.charToGlyph(ch).advanceWidth * (size / b.unitsPerEm)
    const advance  = advanceA * (1 - bl) + advanceB * bl

    glyphs.push({ d, x, w: advance })
    x += advance
  }
  return { glyphs, totalWidth: x }
}

export default function MorphedText({
  text,
  width1, weight1, italic1 = false,
  width2, weight2, italic2 = false,
  blend = 0.5,
  curve = 'flat',
  cp1   = { x: 0.33, y: 0.33 },
  cp2   = { x: 0.66, y: 0.66 },
  size  = 96,
  color = 'currentColor',
  fallbackStyle,
}) {
  const [fonts, setFonts] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    Promise.all([
      loadFont(width1, weight1, italic1),
      loadFont(width2, weight2, italic2),
    ]).then(([a, b]) => {
      if (cancelled) return
      setFonts({ a, b })
    }).catch((e) => {
      if (cancelled) return
      setError(e?.message ?? String(e))
    })
    return () => { cancelled = true }
  }, [width1, weight1, italic1, width2, weight2, italic2])

  if (error || !fonts || !text) {
    return <span style={fallbackStyle}>{text}</span>
  }

  const { glyphs, totalWidth } = buildGlyphData(fonts, text, blend, size, curve, cp1, cp2)
  const padY     = size * FALLBACK_VIEWBOX_PAD
  const vbHeight = size + padY * 2

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 ${-padY} ${Math.max(1, totalWidth)} ${vbHeight}`}
      width={totalWidth}
      height={vbHeight}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label={text}
    >
      <g fill={color} fillRule="evenodd" transform={`translate(0 ${size})`}>
        {glyphs.map((g, i) => (
          g.d ? <path key={i} d={g.d} transform={`translate(${g.x.toFixed(2)} 0)`} /> : null
        ))}
      </g>
    </svg>
  )
}
