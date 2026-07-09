/**
 * Resolve a CSS custom property to its raw computed value (untransformed).
 *
 * Returns whatever `getComputedStyle().getPropertyValue()` reads — usually
 * literal values like `48px`, `'Right Grotesk Narrow', sans-serif`,
 * `color-mix(...)`. For var() chains, the chain stays unresolved (use
 * `resolveCssVar` instead, which uses a probe + property assignment to force
 * full resolution). SSR-safe.
 *
 * Use cases:
 *   - size tokens: --kol-text-heading-01 → "48px"
 *   - family tokens: --kol-font-family-sans-narrow → "'Right Grotesk Narrow', ..."
 *   - any non-color token where you want the literal declared value
 */
export function resolveCssVarRaw(name) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Resolve a CSS custom property to its computed hex value.
 *
 * Forces full var() chain resolution by applying the var to a real CSS
 * property (color) on a hidden DOM node and reading the computed value.
 * Returns uppercase hex format (e.g. '#FFCF33'). SSR-safe — returns empty
 * string when window is undefined.
 *
 * Single source of truth for any color in the system: kol-color.css. Edit a
 * token there, every consumer (chips, ramps, palettes, generators) updates on
 * next render.
 */
export function resolveCssVar(name) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return ''
  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.color = `var(${name})`
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  document.body.removeChild(probe)
  const m = computed.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  return m ? rgbToHex(+m[1], +m[2], +m[3]) : computed
}

/**
 * RGB components (0–255) → uppercase hex ('#FFCF33'). Shared with the canvas
 * eyedropper.
 */
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}
