/**
 * Shape catalog for the pattern generator.
 *
 * Globs SVGs from this mode's `abstracts/` folder at build time. Each shape
 * exposes its raw SVG string; the renderer parses out the inner body + viewBox
 * and re-uses it inside a <symbol>.
 *
 * Adds a synthetic 'custom' option whose body comes from the user's textarea.
 */

const abstractModules = import.meta.glob(
  './abstracts/*.svg',
  { eager: true, query: '?raw', import: 'default' }
)

const ABSTRACT_SHAPES = Object.entries(abstractModules)
  .map(([path, raw]) => {
    const name = path.match(/\/([^/]+)\.svg$/)?.[1] ?? 'unknown'
    return { id: `abstract:${name}`, label: name, svg: raw }
  })
  .sort((a, b) => a.label.localeCompare(b.label))

export const SHAPE_OPTIONS = [
  ...ABSTRACT_SHAPES.map((s) => ({ value: s.id, label: s.label })),
  { value: 'custom', label: 'Custom SVG…' },
]

export const DEFAULT_SHAPE_ID = ABSTRACT_SHAPES[0]?.id ?? 'custom'

export function getShapeSvg(id, customSvg = '') {
  if (id === 'custom') return customSvg
  return ABSTRACT_SHAPES.find((s) => s.id === id)?.svg ?? ''
}
