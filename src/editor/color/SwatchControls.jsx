import EditorIcon from '../icons/EditorIcon'

/**
 * SwatchStack + EyedropPick — macOS-port custom-tuned chrome for the colour
 * picker top row. Hand-tuned visuals (specific shadows, offsets, sizes,
 * gradients). DO NOT refactor pieces to atoms — the look is intentional and
 * matches the Ref design.
 *
 * Two components exported:
 *
 *   <SwatchStack fillColor strokeColor activePaint onSwap onClear />
 *     — fill + stroke swatch chips at fixed positions (fill upper-left,
 *       stroke lower-right). `activePaint` picks one of two named variants
 *       (SwatchFillFront / SwatchStrokeFront) wholesale — the active paint
 *       is rendered SECOND so it paints on top in the overlap. No z-index,
 *       no transform; DOM order alone determines stacking. Click either
 *       circle → onSwap. Plus swap-arrow icon at top-right and slash-circle
 *       "set to none" indicator at bottom-left.
 *
 *   <EyedropPick sampleColor onPick />
 *     — eyedropper icon button + small sample swatch chip showing the
 *       active color. Disabled when EyeDropper API isn't supported.
 */

/* SwatchStack — picks one of two named variants wholesale based on
 * `activePaint`. Both variants pin fill at FILL_SLOT and stroke at
 * STROKE_SLOT — same positions in both. Only the DOM render order changes:
 * the active paint is rendered SECOND so it paints on top in the overlap.
 * No z-index, no transform. Click either circle → onSwap. */
const FILL_SLOT   = { left: 5,  top: 6  }
const STROKE_SLOT = { left: 15, top: 16 }
const CHIP_BASE   = {
  position: 'absolute',
  width: 22, height: 22,
  borderRadius: '50%',
  boxShadow: '0 0 0 1px #000, 0 0 0 2px #505050',
  border: 'none', padding: 0, cursor: 'pointer',
}

function SwatchFillFront({ fillColor, strokeColor, onSwap, onClear }) {
  return (
    <div className="relative shrink-0" style={{ position: 'relative', width: 44, height: 44 }}>
      <button type="button" data-id="stroke" onClick={onSwap} style={{ ...CHIP_BASE, ...STROKE_SLOT, background: strokeColor }} />
      <button type="button" data-id="fill"   onClick={onSwap} style={{ ...CHIP_BASE, ...FILL_SLOT,   background: fillColor   }} />
      <SwapButton onSwap={onSwap} />
      <NoneMarker onClick={onClear} className="absolute" style={{ left: 1, top: 32 }} />
    </div>
  )
}

function SwatchStrokeFront({ fillColor, strokeColor, onSwap, onClear }) {
  return (
    <div className="relative shrink-0" style={{ position: 'relative', width: 44, height: 44 }}>
      <button type="button" data-id="fill"   onClick={onSwap} style={{ ...CHIP_BASE, ...FILL_SLOT,   background: fillColor   }} />
      <button type="button" data-id="stroke" onClick={onSwap} style={{ ...CHIP_BASE, ...STROKE_SLOT, background: strokeColor }} />
      <SwapButton onSwap={onSwap} />
      <NoneMarker onClick={onClear} className="absolute" style={{ left: 1, top: 32 }} />
    </div>
  )
}

function SwapButton({ onSwap }) {
  return (
    <button
      type="button"
      onClick={onSwap}
      aria-label="Swap colors"
      className="absolute text-fg hover:opacity-80"
      style={{ left: 28, top: 0, width: 16, height: 16, lineHeight: 0 }}
    >
      <EditorIcon name="swap" size={16} />
    </button>
  )
}

export function SwatchStack({ fillColor = '#FFFFFF', strokeColor = '#000000', activePaint = 'fill', onSwap, onClear }) {
  return activePaint === 'fill'
    ? <SwatchFillFront   fillColor={fillColor} strokeColor={strokeColor} onSwap={onSwap} onClear={onClear} />
    : <SwatchStrokeFront fillColor={fillColor} strokeColor={strokeColor} onSwap={onSwap} onClear={onClear} />
}

export function EyedropPick({ sampleColor, onPick }) {
  return (
    <div className="flex items-start gap-1 shrink-0">
      <button
        type="button"
        onClick={onPick}
        aria-label="Eyedropper"
        title="Pick a color from the canvas"
        className="text-fg hover:opacity-80"
        style={{ lineHeight: 0 }}
      >
        <EditorIcon name="eyedrop" size={24} />
      </button>
      <FramedSwatch shape="circle" size={16} color={sampleColor} style={{ marginTop: 4 }} />
    </div>
  )
}

/* ────────── Internal helpers (not exported) ────────── */

function FramedSwatch({ shape = 'square', size = 28, color = '#FFFFFF', className = '', style, onClick, title, ...rest }) {
  const Tag   = onClick ? 'button' : 'span'
  const props = onClick ? { type: 'button', onClick, title, 'aria-label': title ?? 'Swatch' } : {}
  return (
    <Tag
      {...props}
      {...rest}
      className={`inline-block ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: shape === 'circle' ? '50%' : 0,
        boxShadow: '0 0 0 1px #000, 0 0 0 2px #505050',
        padding: 0,
        border: 'none',
        ...style,
      }}
    />
  )
}

function NoneMarker({ onClick, className = '', style }) {
  const Tag   = onClick ? 'button' : 'span'
  const props = onClick ? { type: 'button', onClick, 'aria-label': 'Clear color' } : {}
  return (
    <Tag
      {...props}
      className={`rounded-full overflow-hidden ${className}`}
      style={{
        width: 10,
        height: 10,
        background:
          'linear-gradient(45deg, #fff 0%, #fff 42%, #DC2626 42%, #DC2626 58%, #fff 58%, #fff 100%)',
        boxShadow: '0 0 0 1px var(--kol-fg-32)',
        ...style,
      }}
    />
  )
}
