// Composition — arrangement patterns for N objects. layout() returns a base
// position per item (pure + deterministic, so scrub/export stay reproducible).
// `spread` is the radius / spacing knob; the preset/keyframe animation is added
// on top of these base positions in the engine loop.

export const ARRANGEMENTS = [
  { value: 'single', label: 'Single' },
  { value: 'ring', label: 'Ring' },
  { value: 'grid', label: 'Grid' },
  { value: 'line', label: 'Line' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'scatter', label: 'Scatter' },
]

const TAU = Math.PI * 2
const GOLDEN = 2.399963229728653 // golden angle (rad)

// Deterministic [-1,1] hash for scatter (no Math.random → reproducible).
function hash(i, salt) {
  const x = Math.sin((i + 1) * salt) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

export function layout(pattern, count, spread) {
  const n = Math.max(1, Math.round(count))
  const out = []
  if (pattern === 'single' || n === 1) {
    for (let i = 0; i < n; i++) out.push([0, 0, 0])
    return out
  }
  if (pattern === 'ring') {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU
      out.push([Math.cos(a) * spread, 0, Math.sin(a) * spread])
    }
  } else if (pattern === 'line') {
    for (let i = 0; i < n; i++) out.push([(i - (n - 1) / 2) * spread, 0, 0])
  } else if (pattern === 'grid') {
    const cols = Math.ceil(Math.sqrt(n))
    const rows = Math.ceil(n / cols)
    for (let i = 0; i < n; i++) {
      const cx = i % cols
      const cy = Math.floor(i / cols)
      out.push([(cx - (cols - 1) / 2) * spread, ((rows - 1) / 2 - cy) * spread, 0])
    }
  } else if (pattern === 'spiral') {
    for (let i = 0; i < n; i++) {
      const a = i * GOLDEN
      const r = spread * Math.sqrt(i / n) * 1.3
      out.push([Math.cos(a) * r, (i / n - 0.5) * spread * 1.5, Math.sin(a) * r])
    }
  } else if (pattern === 'scatter') {
    for (let i = 0; i < n; i++) {
      out.push([hash(i, 12.9898) * spread, hash(i, 78.233) * spread * 0.7, hash(i, 37.719) * spread])
    }
  } else {
    for (let i = 0; i < n; i++) out.push([0, 0, 0])
  }
  return out
}
