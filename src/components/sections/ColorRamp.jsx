import { useEffect, useState } from 'react'

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
  return rgbToHex(computed)
}

function rgbToHex(rgb) {
  const m = rgb.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return rgb
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n, 10).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/**
 * Live read of a non-color token (e.g. size, family). Returns the trimmed
 * computed value as a span — useful in table cells where you want the live
 * value, not a hardcoded literal.
 *
 * For colors use `<LiveHex>` patterns elsewhere — those use the probe trick
 * (resolveCssVar) because color values can be in rgb() form.
 */
export function LiveValue({ token }) {
  const [value, setValue] = useState('')
  useEffect(() => { setValue(resolveCssVarRaw(token)) }, [token])
  return <span>{value}</span>
}

/**
 * Single live swatch — renders the CSS var as background, reads the resolved
 * hex as the displayed label.
 */
export function Chip({ token, name, anchor }) {
  const [hex, setHex] = useState('')
  useEffect(() => {
    setHex(resolveCssVar(token))
  }, [token])

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`aspect-square rounded-[3px] border border-fg-08 ${anchor ? 'outline outline-2 outline-offset-2 outline-fg-48' : ''}`}
        style={{ backgroundColor: `var(${token})` }}
        aria-label={`${name} ${hex}`}
      />
      <div className="flex flex-col items-start font-mono leading-tight">
        <span className="text-[10px] text-emphasis">
          {name}{anchor && ' ★'}
        </span>
        <span className="text-[10px] text-meta">{hex}</span>
      </div>
    </div>
  )
}

/**
 * Full ramp row — name + optional note + N swatches. Reads stops live from
 * CSS via Chip → resolveCssVar.
 *
 * Usage:
 *   <ColorRamp ramp="brand-yellow" anchor={300} note="Pure yellow lock." />
 *   <ColorRamp ramp="cream" />
 *   <ColorRamp ramp="grey" stops={[50,100,200,300,400,500,600,700,800,900]} />
 */
export default function ColorRamp({
  ramp,
  anchor,
  stops = [100, 200, 300, 400, 500],
  note,
}) {
  return (
    <div className="flex flex-col gap-3 py-5 border-b border-fg-08 last:border-b-0">
      <div className="flex items-baseline justify-between gap-6 flex-wrap">
        <span className="text-[12px] uppercase tracking-widest font-mono text-emphasis">{ramp}</span>
        {note && <span className="text-[11px] text-meta italic max-w-[60ch] text-right">{note}</span>}
      </div>
      <div className={`grid gap-2 ${stops.length === 5 ? 'grid-cols-5' : 'grid-cols-5 sm:grid-cols-10'}`}>
        {stops.map(s => (
          <Chip
            key={s}
            token={`--${ramp}-${s}`}
            name={`${ramp}-${s}`}
            anchor={anchor === s}
          />
        ))}
      </div>
    </div>
  )
}
