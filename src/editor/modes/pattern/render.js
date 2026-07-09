/**
 * Pattern → SVG string builder.
 *
 * Single source of truth for both live preview (rendered via
 * dangerouslySetInnerHTML) and download. Output is a self-contained SVG using
 * <symbol> + <use> so big grids stay small.
 *
 * Source-shape SVG is parsed for its viewBox + inner body. currentColor in the
 * source is preserved; the root SVG sets `color` so it resolves to the
 * user-chosen shape color.
 *
 * Rules: per-cell selectors + transforms compose in array order. Predicates
 * operate on group coordinates (`groupW`/`groupH` defaults 1×1, so cell-level).
 * Transforms: rotate (sums), flipH/flipV (multiply scale), opacity (multiplies),
 * hide (skips emission). The `expression` predicate evaluates user JS with
 * `i,col,row,cols,rows` in scope and `Math.*` (sin/cos/abs/floor/PI) available.
 */


const DEFAULT_VIEW_BOX = '0 0 24 24'

function parseShape(svg) {
  if (!svg) return { viewBox: DEFAULT_VIEW_BOX, body: '' }
  const vb    = svg.match(/viewBox=["']([^"']+)["']/i)?.[1] ?? DEFAULT_VIEW_BOX
  const inner = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)?.[1] ?? ''
  return { viewBox: vb, body: inner.trim() }
}

function compileExpression(expr) {
  if (!expr || typeof expr !== 'string') return null
  try {
    // eslint-disable-next-line no-new-func
    return new Function(
      'i', 'col', 'row', 'cols', 'rows',
      `with(Math){return (${expr}) > 0}`
    )
  } catch {
    return null
  }
}

function ruleMatches(rule, ctx, compiledExpr) {
  const gW    = Math.max(1, rule.groupW | 0 || 1)
  const gH    = Math.max(1, rule.groupH | 0 || 1)
  const gCol  = Math.floor(ctx.col / gW)
  const gRow  = Math.floor(ctx.row / gH)
  const gCols = Math.ceil(ctx.cols / gW)
  const gRows = Math.ceil(ctx.rows / gH)
  const gI    = gRow * gCols + gCol

  switch (rule.selectKind) {
    case 'all':       return true
    case 'checker':   return (gRow + gCol) % 2 === 0
    case 'every-col': return ((gCol + (rule.offset | 0)) % Math.max(1, rule.n | 0)) === 0
    case 'every-row': return ((gRow + (rule.offset | 0)) % Math.max(1, rule.n | 0)) === 0
    case 'every-nth': return ((gI   + (rule.offset | 0)) % Math.max(1, rule.n | 0)) === 0
    case 'both':
      return (((gCol + (rule.offset  | 0)) % Math.max(1, rule.n  | 0)) === 0)
          && (((gRow + (rule.offset2 | 0)) % Math.max(1, rule.n2 | 0)) === 0)
    case 'expression':
      try { return compiledExpr ? !!compiledExpr(gI, gCol, gRow, gCols, gRows) : false }
      catch { return false }
    default: return false
  }
}

function composeCell(rules, compiled, ctx) {
  const out = { rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, hidden: false }
  for (let k = 0; k < rules.length; k++) {
    const rule = rules[k]
    if (!ruleMatches(rule, ctx, compiled[k])) continue
    if (rule.hide)  out.hidden = true
    if (rule.flipH) out.scaleX *= -1
    if (rule.flipV) out.scaleY *= -1
    if (rule.rotate) out.rotate = (out.rotate + Number(rule.rotate)) % 360
    if (typeof rule.opacity === 'number' && rule.opacity !== 1) {
      out.opacity *= Math.max(0, Math.min(1, rule.opacity))
    }
  }
  return out
}

function transformAttr({ rotate, scaleX, scaleY }, cx, cy) {
  if (!rotate && scaleX === 1 && scaleY === 1) return ''
  const parts = [`translate(${cx.toFixed(2)} ${cy.toFixed(2)})`]
  if (rotate) parts.push(`rotate(${rotate})`)
  if (scaleX !== 1 || scaleY !== 1) parts.push(`scale(${scaleX} ${scaleY})`)
  parts.push(`translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`)
  return ` transform="${parts.join(' ')}"`
}

export function buildPatternSvg({
  shapeSvg,
  cols        = 4,
  rows        = 4,
  gap         = 0,
  stretch     = false,
  padding     = 0,
  overflow    = false,
  rules       = [],
  color       = '#0E0E11',
  bg          = '#FCFBF8',
  stroke      = null,
  strokeWidth = 0,
  size        = 256,
}) {
  const { viewBox, body } = parseShape(shapeSvg)
  const c   = Math.max(1, Math.floor(cols))
  const r   = Math.max(1, Math.floor(rows))
  const gPx = Number(gap) || 0
  const pad = Number(padding) || 0

  const innerW = size - 2 * pad
  const innerH = size - 2 * pad
  const cellW  = (innerW - gPx * (c - 1)) / c
  const cellH  = (innerH - gPx * (r - 1)) / r
  const par    = stretch ? 'none' : 'xMidYMid meet'

  const compiled = rules.map((rule) => rule.selectKind === 'expression' ? compileExpression(rule.expression) : null)

  const uses = []
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const i = row * c + col
      const cell = composeCell(rules, compiled, { row, col, cols: c, rows: r, i })
      if (cell.hidden) continue
      const x   = pad + col * (cellW + gPx)
      const y   = pad + row * (cellH + gPx)
      const cx  = x + cellW / 2
      const cy  = y + cellH / 2
      const t   = transformAttr(cell, cx, cy)
      const op  = cell.opacity !== 1 ? ` opacity="${cell.opacity.toFixed(3)}"` : ''
      uses.push(
        `<use href="#shape" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellW.toFixed(2)}" height="${cellH.toFixed(2)}"${t}${op}/>`
      )
    }
  }

  const overflowAttr = overflow ? ' overflow="visible"' : ''
  const hasStroke    = stroke && strokeWidth > 0
  const styleParts   = []
  if (color)     styleParts.push(`color: ${color}`)
  if (hasStroke) styleParts.push(`stroke: ${stroke}`, `stroke-width: ${strokeWidth}`, 'paint-order: stroke fill', 'vector-effect: non-scaling-stroke')
  const styleAttr    = styleParts.length ? ` style="${styleParts.join('; ')}"` : ''
  const bgRect       = bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>\n` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"${overflowAttr}${styleAttr}>
${bgRect}<defs>
<symbol id="shape" viewBox="${viewBox}" preserveAspectRatio="${par}">
${body}
</symbol>
</defs>
${uses.join('\n')}
</svg>`
}
