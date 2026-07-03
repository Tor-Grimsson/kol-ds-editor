/**
 * Text-layer outline export — sync glyph-path generation for compose's
 * SVG builder.
 *
 * `buildLayersSvg` is synchronous (the PNG / webm / eyedropper callers all
 * build in a tight sync path), but opentype font parsing is async. The
 * bridge: export triggers `await warmTextFonts(layers)` BEFORE building,
 * which resolves every text layer's cut through the shared fontLoader
 * promise cache and parks the parsed Font in a sync map. `textLayerFont()`
 * then answers synchronously at build time; a miss (mono cut / fetch failed
 * / a sync caller that never warmed) makes the builder fall back to the
 * legacy foreignObject writer.
 *
 * Layout mirrors the live render (LayerRenderer's TextLayer wrapper +
 * TypeBlock div) so outlines land where the canvas shows them:
 *   - flex align-center wrapper — the line stack is vertically centered in
 *     layer.h, with TypeBlock's `min-height: 1em` floor
 *   - `white-space: pre-wrap` + `overflow-wrap: break-word` — hard \n breaks
 *     plus greedy soft-wrap at layer.w, char-level breaks for oversized words
 *   - letter-spacing in em after every glyph incl. the last (CSS behavior);
 *     kerning on; ligatures only at zero tracking (browsers drop optional
 *     ligatures when letter-spacing is non-zero)
 *   - baselines via the CSS half-leading model over hhea ascent/descent
 *     (what Chrome/mac uses for the line box content area)
 */

import { loadFont } from './fontLoader'
import { applyCase } from './cuts'

/* Resolved (not promised) Fonts, keyed like fontLoader's promise cache. */
const warm = new Map()

const keyOf = (width, weight, italic) => `${width}-${weight}-${italic ? '1' : '0'}`

/**
 * Parse-and-cache every cut used by text layers (groups walked deep).
 * Await this before a sync buildLayersSvg call; failures are swallowed —
 * the affected layer just falls back to foreignObject.
 */
export async function warmTextFonts(layers) {
  const jobs = []
  const walk = (ls) => {
    for (const l of ls ?? []) {
      if (l.type === 'group') { walk(l.children); continue }
      if (l.type !== 'text') continue
      const width = l.width ?? 'Tight'
      /* mono → JetBrains Mono, which ships woff2-only (no TTF under
       * /fonts/Right-Grotesk-ttf and opentype.js can't parse woff2) —
       * never warms, always exports via the foreignObject fallback. */
      if (width === 'mono') continue
      const key = keyOf(width, l.weight ?? 600, !!l.italic)
      if (warm.has(key)) continue
      jobs.push(
        loadFont(width, l.weight ?? 600, !!l.italic)
          .then((font) => { warm.set(key, font) })
          .catch(() => {}),
      )
    }
  }
  walk(layers)
  await Promise.all(jobs)
}

/** Sync lookup for a text layer's parsed Font. Null = use the fallback. */
export function textLayerFont(layer) {
  const width = layer.width ?? 'Tight'
  if (width === 'mono') return null
  return warm.get(keyOf(width, layer.weight ?? 600, !!layer.italic)) ?? null
}

/* opentype render options for a given em tracking. Options merge over
 * defaultRenderOptions (kerning stays on); non-zero tracking clears the
 * ligature features, matching CSS ("UAs should not apply optional ligatures
 * when letter-spacing is non-zero"). */
const renderOpts = (track) =>
  track === 0 ? {} : { letterSpacing: track, features: [] }

/* Greedy soft-wrap of one hard line to maxW, measured with the SAME
 * advance/kerning/letter-spacing engine that draws the glyphs. Whitespace
 * never forces a break (pre-wrap hangs trailing spaces); a word wider than
 * the box splits at character level (overflow-wrap: break-word). */
function wrapLine(font, text, size, opts, maxW) {
  if (!text.trim() || maxW <= 0) return [text]
  /* Trailing whitespace hangs — excluded from measurement. */
  const measure = (s) => font.getAdvanceWidth(s.replace(/\s+$/, ''), size, opts)
  const tokens = text.split(/(\s+)/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const tok of tokens) {
    if (/^\s+$/.test(tok)) { cur += tok; continue }
    if (cur.trim() && measure(cur + tok) > maxW) { lines.push(cur); cur = tok }
    else cur += tok
    while (measure(cur) > maxW && cur.trim().length > 1) {
      let n = cur.length - 1
      while (n > 1 && measure(cur.slice(0, n)) > maxW) n -= 1
      lines.push(cur.slice(0, n))
      cur = cur.slice(n)
    }
  }
  lines.push(cur)
  return lines
}

/**
 * Compute the layer's glyph outlines as layer-local path data strings
 * (one `<path d>` per rendered line). Empty array = nothing to draw.
 */
export function textOutlinePaths(layer, font) {
  const size  = layer.size ?? 96
  const track = layer.tracking ?? -0.01
  const lh    = layer.lineHeight ?? 1.05
  const align = layer.textAlign ?? 'center'
  const w     = layer.w ?? 0
  const h     = layer.h ?? 0

  const display = applyCase(String(layer.text ?? ''), layer.case)
  if (!display.trim()) return []

  const opts  = renderOpts(track)
  const lines = display.split('\n').flatMap((ln) => wrapLine(font, ln, size, opts, w))

  const scale   = size / font.unitsPerEm
  const ascent  = font.ascender * scale
  const descent = -font.descender * scale        /* hhea descender is negative */
  const lineH   = lh * size
  const blockH  = Math.max(lines.length * lineH, size)  /* min-height: 1em */
  const top     = (h - blockH) / 2

  const paths = []
  lines.forEach((line, i) => {
    const text = line.replace(/\s+$/, '')        /* trailing spaces hang */
    if (!text) return                            /* blank line still holds its slot */
    const lineW = font.getAdvanceWidth(text, size, opts)
    const lx = align === 'left' ? 0 : align === 'right' ? w - lineW : (w - lineW) / 2
    const baseY = top + i * lineH + (lineH - (ascent + descent)) / 2 + ascent
    const d = font.getPath(text, lx, baseY, size, opts).toPathData(2)
    if (d) paths.push(d)
  })
  return paths
}
