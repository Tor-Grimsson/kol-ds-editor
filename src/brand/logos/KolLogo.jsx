import Logomark   from './svg/kol-logomark.svg?react'
import Wordmark   from './svg/kol-wordmark.svg?react'
import LockupHori from './svg/kol-lockup-hori.svg?react'
import LockupVert from './svg/kol-lockup-vert.svg?react'

const VARIANTS = {
  logomark:      Logomark,
  wordmark:      Wordmark,
  'lockup-hori': LockupHori,
  'lockup-vert': LockupVert,
}

export const KOL_LOGO_VARIANTS = Object.keys(VARIANTS)

/* Natural dimensions per variant — drawn from each SVG's viewBox.
 * Used by AssetsBody to insert a logo layer at its true aspect ratio so
 * the user starts with a wireframe that matches the logo, then resizes
 * (uniformly or not — preserveAspectRatio="none" lets it stretch). */
export const KOL_LOGO_NATURAL_DIMS = {
  logomark:      { w: 320, h: 320 },        // 32×32 viewBox, scaled up
  wordmark:      { w: 540, h: 160 },        // 135×40 viewBox × 4
  'lockup-hori': { w: 419, h: 128 },        // matches viewBox 1:1
  'lockup-vert': { w: 420, h: 128 },        // matches viewBox 1:1
}

/**
 * KolLogo — render a brand logo as a real React SVG component.
 *
 * Powered by `vite-plugin-svgr` (`?react` import suffix). Each SVG becomes
 * a proper React component that takes width / height / className / style
 * directly — no inline-SVG sizing quirks, no string-replacement hacks.
 *
 * Default behavior: SVG renders at its intrinsic size (driven by viewBox).
 * Pass explicit `width` / `height` (or apply `className="w-full h-full"`)
 * to size it. The SVG's default `preserveAspectRatio="xMidYMid meet"`
 * keeps content aspect-correct and contained.
 *
 * `currentColor` paint inheritance still works — the parent's `color`
 * cascades into the SVG's `fill="currentColor"` paths exactly as before.
 */
export default function KolLogo({
  variant = 'lockup-hori',
  width,
  height,
  className = '',
  style,
  title,
  preserveAspectRatio = 'xMidYMid meet',
  ...rest
}) {
  const Cmp = VARIANTS[variant]
  if (!Cmp) {
    if (import.meta.env.DEV) console.warn(`KolLogo: variant "${variant}" not found`)
    return null
  }
  return (
    <Cmp
      width={width}
      height={height}
      className={`kol-logo ${className}`.trim()}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
      preserveAspectRatio={preserveAspectRatio}
      {...rest}
    />
  )
}
