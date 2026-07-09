import { useRef } from 'react'
import { LabeledControl } from '@kolkrabbi/kol-component'
import { DEFAULT_CURVE } from '../../../loops/pattern/fields/organicField.js'

/**
 * ProfileEditor — editable bezier profile for the organic band edge, ported
 * from labs (kol-labs-single/src/pages/loops/ProfileEditor.jsx, verbatim
 * geometry). Nodes carry in/out handle offsets (hl/hr); the path is
 * cubic-bezier between them. Normalized space: x ∈ [0,1] (one period) ·
 * y ∈ [-1,1]. Endpoints (x=0,1) are x-locked and share y so the profile
 * tiles seamlessly. Drag anchors + handles; double-click bg to add a node,
 * double-click an inner anchor to remove it.
 *
 * The engine side already ships in this repo — organicField.js bakes the
 * node array (`waveCurve`) to a LUT via sampleCurveLUT/customWave when
 * waveProfile === 'custom'.
 */
const W = 240, H = 120, PAD = 12
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const px = (nx) => nx * W
const py = (ny) => H / 2 - ny * (H / 2 - PAD)

export default function ProfileEditor({ value, onChange }) {
  const nodes = (Array.isArray(value) && value.length > 1) ? value : DEFAULT_CURVE
  const svgRef = useRef(null)
  const drag = useRef(null)

  const toNorm = (e) => {
    const svg = svgRef.current
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY
    const sp = pt.matrixTransform(svg.getScreenCTM().inverse()) // → viewBox units (handles any scaling)
    return { nx: sp.x / W, ny: (H / 2 - sp.y) / (H / 2 - PAD) }
  }

  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const { nx, ny } = toNorm(e)
    const cy = clamp(ny, -1, 1)
    const next = nodes.map((n) => ({ ...n }))
    const node = next[d.i]
    if (d.type === 'anchor') {
      const isFirst = d.i === 0, isLast = d.i === next.length - 1
      if (!isFirst && !isLast) node.x = clamp(nx, next[d.i - 1].x + 0.02, next[d.i + 1].x - 0.02)
      node.y = cy
      if (isFirst) next[next.length - 1].y = cy // endpoints share y ⇒ seamless tile
      if (isLast) next[0].y = cy
    } else if (d.type === 'hr') {
      node.hrx = nx - node.x; node.hry = cy - node.y
    } else {
      node.hlx = nx - node.x; node.hly = cy - node.y
    }
    onChange(next)
  }
  const start = (type, i) => (e) => { e.stopPropagation(); drag.current = { type, i }; try { e.target.setPointerCapture(e.pointerId) } catch { /* */ } }
  const end = (e) => { drag.current = null; try { e.target.releasePointerCapture(e.pointerId) } catch { /* */ } }

  const addNode = (e) => {
    const { nx, ny } = toNorm(e)
    const x = clamp(nx, 0.04, 0.96)
    const idx = nodes.findIndex((n) => n.x > x)
    const at = idx < 0 ? nodes.length - 1 : idx
    const next = nodes.map((n) => ({ ...n }))
    next.splice(at, 0, { x, y: clamp(ny, -1, 1), hlx: -0.08, hly: 0, hrx: 0.08, hry: 0 })
    onChange(next)
  }
  const removeNode = (i) => (e) => {
    e.stopPropagation()
    if (i === 0 || i === nodes.length - 1 || nodes.length <= 3) return
    onChange(nodes.filter((_, k) => k !== i))
  }

  const d = nodes.map((n, i) => {
    if (i === 0) return `M ${px(n.x)} ${py(n.y)}`
    const a = nodes[i - 1]
    return `C ${px(a.x + a.hrx)} ${py(a.y + a.hry)}, ${px(n.x + n.hlx)} ${py(n.y + n.hly)}, ${px(n.x)} ${py(n.y)}`
  }).join(' ')

  return (
    <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
      className="rounded touch-none select-none" style={{ background: 'var(--kol-surface-primary)' }}
      onPointerMove={onMove} onPointerUp={end} onPointerLeave={end} onDoubleClick={addNode}>
      <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="var(--kol-fg-16)" strokeWidth="1" />
      <path d={d} fill="none" stroke="var(--kol-fg-80)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {nodes.map((n, i) => (
        <g key={i}>
          <line x1={px(n.x)} y1={py(n.y)} x2={px(n.x + n.hlx)} y2={py(n.y + n.hly)} stroke="var(--kol-fg-32)" vectorEffect="non-scaling-stroke" />
          <line x1={px(n.x)} y1={py(n.y)} x2={px(n.x + n.hrx)} y2={py(n.y + n.hry)} stroke="var(--kol-fg-32)" vectorEffect="non-scaling-stroke" />
          <circle cx={px(n.x + n.hlx)} cy={py(n.y + n.hly)} r="3.5" fill="var(--kol-fg-48)" className="cursor-grab" onPointerDown={start('hl', i)} />
          <circle cx={px(n.x + n.hrx)} cy={py(n.y + n.hry)} r="3.5" fill="var(--kol-fg-48)" className="cursor-grab" onPointerDown={start('hr', i)} />
          <circle cx={px(n.x)} cy={py(n.y)} r="5" fill="var(--kol-surface-on-primary)" className="cursor-grab"
            onPointerDown={start('anchor', i)} onDoubleClick={removeNode(i)} />
        </g>
      ))}
    </svg>
  )
}

/**
 * OrganicProfileEditor — the pattern-rules mount wrapper: shows the curve
 * editor only on organic field layers with waveProfile === 'custom' (the
 * schema dropdown's Custom option, patternLoop PROFILE_OPTIONS). Drag writes
 * ride the coalesced `patch` (one undo per drag). A just-picked Custom with
 * no curve yet displays DEFAULT_CURVE (a sine-shaped seed — matching
 * drawOrganic's sine fallback for a null waveCurve); the first drag persists
 * the full node array.
 */
export function OrganicProfileEditor({ layer, patch }) {
  if (layer.render !== 'field' || layer.field !== 'organic' || layer.waveProfile !== 'custom') return null
  const value = (Array.isArray(layer.waveCurve) && layer.waveCurve.length > 1) ? layer.waveCurve : DEFAULT_CURVE
  return (
    <LabeledControl label="Profile curve">
      <ProfileEditor value={value} onChange={(c) => patch({ waveCurve: c })} />
    </LabeledControl>
  )
}
