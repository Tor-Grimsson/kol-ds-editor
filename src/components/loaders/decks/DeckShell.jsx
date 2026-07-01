import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useEmblaCarousel from 'embla-carousel-react'
import { Icon } from '@kolkrabbi/kol-loader'
import './deckStyles'   /* CSS auto-injects on import */

/**
 * DeckShell — embla-wrapped 1920×1080 deck.
 *
 * Two modes:
 *   - `fullscreen` (default): fixed inset:0, scales to viewport, keyboard
 *     navigation (←/→/Space) and Esc-to-exit, close button.
 *   - `inline`: fits parent container width, controls positioned within the
 *     deck box (no keyboard hijacking, no exit).
 */
export default function DeckShell({ children, total, inline = false, onExit }) {
  const navigate = useNavigate()
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false })
  const [idx, setIdx] = useState(0)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  const wrapRef = useRef(null)
  const [scale, setScale] = useState(1)

  // Inline mode — measure the wrapper and scale the 1920px stage to fit width.
  useEffect(() => {
    if (!inline) return
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      if (w > 0) setScale(w / 1920)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [inline])

  const exit = useCallback(() => {
    if (onExit) onExit()
    else navigate(-1)
  }, [navigate, onExit])

  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    const onSelect = () => {
      setIdx(emblaApi.selectedScrollSnap())
      setCanPrev(emblaApi.canScrollPrev())
      setCanNext(emblaApi.canScrollNext())
    }
    onSelect()
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi])

  // Keyboard nav only in fullscreen mode (inline shouldn't hijack page keys).
  useEffect(() => {
    if (inline) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  prev()
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      else if (e.key === 'Escape') exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, exit, inline])

  if (inline) {
    return (
      <div className="runway-deck-inline" ref={wrapRef}>
        <div
          className="runway-deck-stage"
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <div className="embla" ref={emblaRef}>
            <div className="embla__track">{children}</div>
          </div>
        </div>

        <span className="runway-deck-inline-counter">
          {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <button type="button" className="runway-deck-arrow runway-deck-arrow--inline-prev" onClick={prev} disabled={!canPrev} aria-label="Previous slide"><Icon name="chevron-left"  size={12} /></button>
        <button type="button" className="runway-deck-arrow runway-deck-arrow--inline-next" onClick={next} disabled={!canNext} aria-label="Next slide"><Icon name="chevron-right" size={12} /></button>
      </div>
    )
  }

  return (
    <div className="runway-deck-wrap">
      <div className="runway-deck-stage">
        <div className="embla" ref={emblaRef}>
          <div className="embla__track">{children}</div>
        </div>
      </div>

      <span className="runway-deck-ui runway-deck-ui--counter">
        {String(idx + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </span>
      <button type="button" className="runway-deck-ui runway-deck-ui--exit" onClick={exit}>Close · Esc</button>
      <button type="button" className="runway-deck-arrow runway-deck-arrow--fs-prev" onClick={prev} disabled={!canPrev} aria-label="Previous slide"><Icon name="chevron-left"  size={12} /></button>
      <button type="button" className="runway-deck-arrow runway-deck-arrow--fs-next" onClick={next} disabled={!canNext} aria-label="Next slide"><Icon name="chevron-right" size={12} /></button>
    </div>
  )
}
