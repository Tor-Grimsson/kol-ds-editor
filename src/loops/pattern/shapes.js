// Shape catalog for the pattern loop — primitives + the abstract SVGs (ported
// from kol-client-kolkrabbi) + a custom-SVG slot. Each shape resolves to a
// { viewBox:[x,y,w,h], paths:[d,…] } so the Canvas2D renderer can build Path2Ds.
// Abstract/custom SVGs fill `currentColor`; we just fill with the shape colour.

const abstractModules = import.meta.glob('./shapes/*.svg', { eager: true, query: '?raw', import: 'default' })

const ABSTRACTS = Object.entries(abstractModules)
  .map(([path, raw]) => {
    const name = path.match(/\/([^/]+)\.svg$/)?.[1] ?? 'unknown'
    return { id: `abstract:${name}`, label: name, svg: raw }
  })
  .sort((a, b) => a.label.localeCompare(b.label))

// Primitive shapes as single SVG path `d` strings in a 0 0 24 24 viewBox.
const PRIMITIVES = [
  { id: 'prim:circle', label: 'circle', d: 'M2 12 A10 10 0 1 1 22 12 A10 10 0 1 1 2 12 Z' },
  { id: 'prim:square', label: 'square', d: 'M3 3 H21 V21 H3 Z' },
  { id: 'prim:triangle', label: 'triangle', d: 'M12 3 L21 20 L3 20 Z' },
  { id: 'prim:diamond', label: 'diamond', d: 'M12 2 L22 12 L12 22 L2 12 Z' },
  { id: 'prim:hexagon', label: 'hexagon', d: 'M7 3 H17 L22 12 L17 21 H7 L2 12 Z' },
  { id: 'prim:plus', label: 'plus', d: 'M9 3 H15 V9 H21 V15 H15 V21 H9 V15 H3 V9 H9 Z' },
  { id: 'prim:bar', label: 'bar', d: 'M2 9 H22 V15 H2 Z' },
  { id: 'prim:star', label: 'star', d: 'M12 2 L14.9 9.2 L22.5 9.6 L16.6 14.5 L18.6 21.9 L12 17.7 L5.4 21.9 L7.4 14.5 L1.5 9.6 L9.1 9.2 Z' },
]

// No 'glyph' entry in this port — the labs glyph tile pulled letterforms via
// opentype.js (lib/glyphPath.js), which the editor deliberately excludes.
export const SHAPE_OPTIONS = [
  ...PRIMITIVES.map((s) => ({ value: s.id, label: s.label })),
  ...ABSTRACTS.map((s) => ({ value: s.id, label: s.label })),
  { value: 'custom', label: 'Custom SVG…' },
]

export const DEFAULT_SHAPE_ID = 'abstract:abstract-01'

function parseSvg(svg) {
  if (!svg) return { viewBox: [0, 0, 24, 24], paths: [] }
  const vbStr = svg.match(/viewBox=["']([^"']+)["']/i)?.[1] || '0 0 24 24'
  const vb = vbStr.trim().split(/[\s,]+/).map(Number)
  const paths = [...svg.matchAll(/<path[^>]*\bd=["']([^"']+)["']/gi)].map((m) => m[1])
  return { viewBox: vb.length === 4 && vb.every((n) => Number.isFinite(n)) ? vb : [0, 0, 24, 24], paths }
}

// id (+ custom svg) → { viewBox, paths }
export function resolveShape(id, customSvg = '') {
  if (id === 'custom') return parseSvg(customSvg)
  const prim = PRIMITIVES.find((s) => s.id === id)
  if (prim) return { viewBox: [0, 0, 24, 24], paths: [prim.d] }
  const ab = ABSTRACTS.find((s) => s.id === id)
  if (ab) return parseSvg(ab.svg)
  return { viewBox: [0, 0, 24, 24], paths: [] }
}
