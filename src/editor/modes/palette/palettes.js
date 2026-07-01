/**
 * Combo Lab shared data — layouts + logos + foreground chooser.
 *
 * Palette data lives in pools.js (live-resolved from CSS at access time).
 * The legacy PALETTES export was removed during the color rebuild —
 * no consumers, replaced by pool-driven generation.
 *
 * Architecture: docs/kol-migration/locked/color-system.md
 */

import { BRAND } from '../../../brand/config'

/* `uses` lists slot indices each layout consumes (0=primary, 1=secondary,
 * 2=light, 3=dark, 4=accent). Used by BG toggle to pick from unused slots. */
export const LAYOUTS = [
  { id: 'ratio-603010',  label: '60 / 30 / 10',     uses: [0, 1, 2] },
  { id: 'tower',         label: 'Tower',            uses: [0, 1, 2, 3] },
  { id: 'quad-split',    label: 'Quad split',       uses: [0, 2, 3, 4] },
  { id: 'card-row',      label: 'Card row',         uses: [0, 1, 2, 3] },
  { id: 'stripe-row',    label: 'Stripe row',       uses: [0, 1, 2, 3, 4] },
  { id: 'applied-card',  label: 'Applied card',     uses: [0, 1, 2, 3, 4] },

  /* Slide layouts — typographic, designed for 16:9 / 5:4. */
  { id: 'slide-cover',     label: 'Slide · Cover',     uses: [0, 2, 3], aspect: '16:9' },
  { id: 'slide-manifesto', label: 'Slide · Manifesto', uses: [2, 3, 4], aspect: '16:9' },
  { id: 'slide-end',       label: 'Slide · End',       uses: [2, 3, 4], aspect: '16:9' },
]

export const LOGOS = [
  { id: 'none',      label: 'No logo' },
  { id: 'primary',   label: BRAND.name,            variant: 'logomark' },
]

// Foreground chooser — pick text color with best contrast against background.
export function fgOn(bg) {
  const hex = bg.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  // relative luminance
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return L > 0.55 ? '#0E0E11' : '#FAFAFA'
}
