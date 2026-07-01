/**
 * Combo Lab slide layouts — re-exports from the unified SlideDeck.
 *
 * The 3 palette-aware slides (Cover / Manifesto / End) live in
 * `loaders/decks/SlideDeck.jsx` so the same components render both inside
 * the Slide deck (greyscale, no palette passed) and standalone here
 * (branded, palette injected). Slide CSS auto-injects on import.
 *
 * Combo Lab / Social Lab / /compose Layout backdrop all consume
 * SLIDE_LAYOUT_COMPONENTS — no API change after the merge.
 */
import { SlideCover, SlideManifesto, SlideEnd } from '../../../components/loaders/decks/SlideDeck'

export { SlideCover, SlideManifesto, SlideEnd }

export const SLIDE_LAYOUT_COMPONENTS = {
  'slide-cover':     SlideCover,
  'slide-manifesto': SlideManifesto,
  'slide-end':       SlideEnd,
}
