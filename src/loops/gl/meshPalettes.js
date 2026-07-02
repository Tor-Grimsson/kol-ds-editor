/* Palette presets + shape/driver registries + a small hue-shift util. */

export const SHAPES = ['sphere', 'plane']

export const DRIVERS = [
  { id: 0, label: 'normal' },
  { id: 1, label: 'rim' },
  { id: 2, label: 'height' },
]

/* Background field styles (engine bgFragment uStyle). */
export const BG_STYLES = [
  { id: 0, label: 'flow' },
  { id: 1, label: 'streaks' },
  { id: 2, label: 'aurora' },
]

export const PALETTES = [
  { id: 'spectrum', label: 'Spectrum', colors: ['#ff3b30', '#ffcc00', '#34c759', '#5ac8fa', '#af52de'] },
  { id: 'heat', label: 'Heat', colors: ['#1a0a04', '#a8210b', '#ff6a00', '#ffd000'] },
  { id: 'iris', label: 'Iris', colors: ['#00e5ff', '#4d7cfe', '#b14dff', '#ff4da6'] },
  { id: 'sunset', label: 'Sunset', colors: ['#2f1b5b', '#ff5e62', '#ffb88c'] },
  { id: 'polar', label: 'Polar', colors: ['#04122e', '#2a6df4', '#9fd4ff', '#f0fbff'] },
  { id: 'acid', label: 'Acid', colors: ['#0a2e0a', '#1faf4b', '#54ff4d', '#eaff00'] },
]

/* Rotate a hex color's hue by deg (HSL round-trip). */
export function shiftHue(hex, deg) {
  if (!deg) return hex
  const n = parseInt(hex.slice(1), 16)
  let r = ((n >> 16) & 255) / 255
  let g = ((n >> 8) & 255) / 255
  let b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  h = (h + deg / 360 + 1) % 1
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  if (s === 0) { r = g = b = l }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  const to255 = (x) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${to255(r)}${to255(g)}${to255(b)}`
}
