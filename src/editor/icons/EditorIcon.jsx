/**
 * EditorIcon — editor-scoped icon loader.
 *
 * Mirrors the KOL `<Icon>` pattern (`import.meta.glob` → cache → markup
 * injection) but its registry is rooted in `src/editor/icons/svg/`. Editor
 * UI (tool palette, cursor swap, layer-stack icons, alignment, and any
 * generic UI affordances the editor uses internally) reaches for this
 * loader instead of the KOL icon registry — keeps editor icons local,
 * named by use (`tool-*`, `cursor-*`, `layer-*`, `align-*`, etc.), and
 * freely iterable without rippling through KOL sync.
 *
 * Naming convention: flat folder, prefix-by-use (`tool-rect`, `layer-text`,
 * `cursor-pattern`). Look up by full name including prefix.
 *
 *   <EditorIcon name="tool-rect" size={14} />
 *
 * For loading SVGs as URLs (e.g. CSS `cursor: url(...)`), bypass this
 * component and use Vite's `?url` import directly:
 *
 *   import rectCursor from '../icons/svg/cursor-rect.svg?url'
 *   style={{ cursor: `url(${rectCursor}) 0 0, crosshair` }}
 */

const svgModules = import.meta.glob('./svg/*.svg', { eager: true, query: '?raw', import: 'default' })

const ICON_CACHE = (() => {
  const cache = {}
  for (const [path, svg] of Object.entries(svgModules)) {
    const name = (path.split('/').pop() || '').replace('.svg', '')
    cache[name] = svg
  }
  return cache
})()

const normalizeSize = (value) => {
  if (typeof value === 'number') return `${value}px`
  if (typeof value === 'string') return value
  return '16px'
}

const applySizeToMarkup = (markup, sizeValue) => {
  let updated = markup
  if (/width="/i.test(updated)) {
    updated = updated.replace(/width="[^"]*"/i, `width="${sizeValue}"`)
  } else {
    updated = updated.replace('<svg', `<svg width="${sizeValue}"`)
  }
  if (/height="/i.test(updated)) {
    updated = updated.replace(/height="[^"]*"/i, `height="${sizeValue}"`)
  } else {
    updated = updated.replace('<svg', `<svg height="${sizeValue}"`)
  }
  return updated
}

export default function EditorIcon({ name, size = 16, className = '', style = {} }) {
  const svgMarkup = ICON_CACHE[name]
  if (!svgMarkup) {
    if (import.meta.env.DEV) console.warn(`EditorIcon "${name}" not found in src/editor/icons/svg/`)
    return null
  }
  const dimension = normalizeSize(size)
  const sizedMarkup = applySizeToMarkup(svgMarkup, dimension)
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{
        width: dimension,
        height: dimension,
        lineHeight: 0,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: sizedMarkup }}
    />
  )
}

export const EDITOR_ICON_NAMES = Object.keys(ICON_CACHE)
