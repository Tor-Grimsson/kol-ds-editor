// Pattern rule engine — ported verbatim from kol-client-kolkrabbi's
// editor/modes/pattern/render.js (self-contained per ARCH §1). Per-cell
// selectors + transforms compose in array order over GROUP coordinates
// (groupW/groupH default 1×1 → cell-level). This is the pure logic; the
// Canvas2D renderer lives in patternLoop.js (kol-client emitted SVG instead).

export const SELECT_OPTIONS = [
  { value: 'all', label: 'All cells' },
  { value: 'every-col', label: 'Every Nth col' },
  { value: 'every-row', label: 'Every Nth row' },
  { value: 'both', label: 'Nth col × Nth row' },
  { value: 'every-nth', label: 'Every Nth (flat)' },
  { value: 'checker', label: 'Checker' },
  { value: 'expression', label: 'Expression…' },
]

export const ROTATE_OPTIONS = [
  { value: 0, label: '0°' },
  { value: 90, label: '90°' },
  { value: 180, label: '180°' },
  { value: 270, label: '270°' },
]

const RANDOM_KINDS = ['every-col', 'every-row', 'both', 'every-nth', 'checker']
const RANDOM_ROTATES = [0, 90, 180, 270]
let nextRuleId = 1
const ruleId = () => `r${nextRuleId++}`
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export const newRule = () => ({
  id: ruleId(),
  selectKind: 'every-col',
  n: 2, offset: 0, n2: 2, offset2: 0,
  expression: 'sin(col * 0.6) + cos(row * 0.6)',
  groupW: 1, groupH: 1,
  rotate: 90, flipH: false, flipV: false, hide: false, opacity: 1,
})

export const randomRule = () => ({
  id: ruleId(),
  selectKind: pick(RANDOM_KINDS),
  n: Math.floor(Math.random() * 5) + 2,
  offset: Math.floor(Math.random() * 3),
  n2: Math.floor(Math.random() * 5) + 2,
  offset2: Math.floor(Math.random() * 3),
  expression: 'sin(col * 0.6) + cos(row * 0.6)',
  groupW: Math.random() > 0.6 ? Math.floor(Math.random() * 3) + 1 : 1,
  groupH: Math.random() > 0.6 ? Math.floor(Math.random() * 3) + 1 : 1,
  rotate: pick(RANDOM_ROTATES),
  flipH: Math.random() > 0.6,
  flipV: Math.random() > 0.6,
  hide: Math.random() > 0.85,
  opacity: Math.random() > 0.7 ? 0.4 + Math.random() * 0.6 : 1,
})

export function compileExpression(expr) {
  if (!expr || typeof expr !== 'string') return null
  try {
    // eslint-disable-next-line no-new-func
    return new Function('i', 'col', 'row', 'cols', 'rows', `with(Math){return (${expr}) > 0}`)
  } catch {
    return null
  }
}

// Pre-compile the expression rules once per render.
export const compileRules = (rules) =>
  (rules || []).map((r) => (r.selectKind === 'expression' ? compileExpression(r.expression) : null))

function ruleMatches(rule, ctx, compiledExpr) {
  const gW = Math.max(1, (rule.groupW | 0) || 1)
  const gH = Math.max(1, (rule.groupH | 0) || 1)
  const gCol = Math.floor(ctx.col / gW)
  const gRow = Math.floor(ctx.row / gH)
  const gCols = Math.ceil(ctx.cols / gW)
  const gRows = Math.ceil(ctx.rows / gH)
  const gI = gRow * gCols + gCol

  switch (rule.selectKind) {
    case 'all': return true
    case 'checker': return (gRow + gCol) % 2 === 0
    case 'every-col': return ((gCol + (rule.offset | 0)) % Math.max(1, rule.n | 0)) === 0
    case 'every-row': return ((gRow + (rule.offset | 0)) % Math.max(1, rule.n | 0)) === 0
    case 'every-nth': return ((gI + (rule.offset | 0)) % Math.max(1, rule.n | 0)) === 0
    case 'both':
      return (((gCol + (rule.offset | 0)) % Math.max(1, rule.n | 0)) === 0)
        && (((gRow + (rule.offset2 | 0)) % Math.max(1, rule.n2 | 0)) === 0)
    case 'expression':
      try { return compiledExpr ? !!compiledExpr(gI, gCol, gRow, gCols, gRows) : false } catch { return false }
    default: return false
  }
}

export function composeCell(rules, compiled, ctx) {
  const out = { rotate: 0, scaleX: 1, scaleY: 1, opacity: 1, hidden: false }
  for (let k = 0; k < (rules || []).length; k++) {
    const rule = rules[k]
    if (!ruleMatches(rule, ctx, compiled[k])) continue
    if (rule.hide) out.hidden = true
    if (rule.flipH) out.scaleX *= -1
    if (rule.flipV) out.scaleY *= -1
    if (rule.rotate) out.rotate = (out.rotate + Number(rule.rotate)) % 360
    if (typeof rule.opacity === 'number' && rule.opacity !== 1) {
      out.opacity *= Math.max(0, Math.min(1, rule.opacity))
    }
  }
  return out
}
