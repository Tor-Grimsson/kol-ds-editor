import { useEffect, useRef, useState } from 'react'
import { familyFor, applyCase } from './cuts'
import { pickCutFor, seedFromBlend } from './axisRandom'
import MorphedText from './MorphedText'
import CurveOverlay from './CurveOverlay'
import TypeBlock from '../../../components/styleguide/TypeBlock'
import TypeBlockToolbar from '../../../components/molecules/TypeBlockToolbar'

/**
 * Single text frame on the TypeCanvas.
 *
 * Owns position + outline + selected-frame chrome (E/W resize handles,
 * blend axis handle, curve overlay, floating toolbar). Composition:
 *   - axisOff (basic) → renders <TypeBlock> from the organism tier;
 *     TypeBlock owns the contentEditable + commit logic
 *   - axisOn morph/random/fade → keeps Type-Lab-specific rendering inline
 *     (MorphedText, span-per-char, fade-blend) plus a hidden inline
 *     contentEditable layer for double-click commit (the morph layer is
 *     pointer-events: none so clicks reach the editable layer underneath)
 *   - <TypeBlockToolbar> renders for both branches when selected
 *
 * Axis-on edit state is local to this file (separate from TypeBlock's
 * basic-branch state) — switching axisOn mid-edit isn't a real flow.
 *
 * Behavior:
 *   - mousedown on body → select + parent starts drag
 *   - mousedown on a resize handle → parent starts resize (data-role)
 *   - mousedown on the blend axis handle → drag blend (0..1)
 *   - double-click → enter contentEditable mode
 */

const sharedTypeStyles = (frame) => ({
  fontWeight:    frame.weight,
  fontStyle:     frame.italic ? 'italic' : 'normal',
  fontSize:      `${frame.size}px`,
  letterSpacing: `${frame.tracking}em`,
  lineHeight:    frame.lineHeight,
  textAlign:     frame.textAlign ?? 'center',
  outline:       'none',
  minHeight:     '1em',
  overflowWrap:  'break-word',
  whiteSpace:    'pre-wrap',
})

export default function TypeFrame({ frame, selected, onMouseDown, onUpdate, onDelete }) {
  const baseStyle = sharedTypeStyles(frame)
  const display   = applyCase(frame.text, frame.case)
  const textTransform =
    frame.case === 'upper' ? 'uppercase' : frame.case === 'lower' ? 'lowercase' : 'none'

  const axisActive = frame.axisOn
  const mode       = frame.axisMode ?? 'morph'

  /* Mode flags — exactly one of morph/fade/random is true when axis is on. */
  const showMorph  = axisActive && mode === 'morph'
  const showFade   = axisActive && mode === 'fade'
  const showRandom = axisActive && mode === 'random'

  /* Random-mode seed derived from blend so the canvas drag handle scrubs the layout. */
  const seed = showRandom ? seedFromBlend(frame.blend) : 0

  /* Local edit state for axis-on branches only. Basic branch's editing
   * lives inside TypeBlock. Switching axisOn mid-edit is not a real flow. */
  const axisTextRef = useRef(null)
  const [axisEditing, setAxisEditing] = useState(false)

  useEffect(() => {
    if (axisEditing && axisTextRef.current) {
      axisTextRef.current.focus()
      const range = document.createRange()
      range.selectNodeContents(axisTextRef.current)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [axisEditing])

  useEffect(() => {
    if (!selected && axisEditing) {
      commitAxisText()
      setAxisEditing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const commitAxisText = () => {
    if (!axisTextRef.current) return
    const next = axisTextRef.current.innerText
    if (next !== frame.text) onUpdate({ text: next })
  }

  const handleAxisDoubleClick = (e) => {
    e.stopPropagation()
    if (selected) setAxisEditing(true)
  }

  const handleAxisKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      commitAxisText()
      setAxisEditing(false)
    }
  }

  const handleAxisBlur = () => {
    commitAxisText()
    setAxisEditing(false)
  }

  /* useState callback ref: when set, triggers a re-render so children
   * (TypeBlockToolbar) receive the live element. A plain useRef wouldn't
   * cause a re-render on first attach, leaving the toolbar's anchor null. */
  const [frameEl, setFrameEl] = useState(null)

  return (
    <div
      ref={setFrameEl}
      className="absolute"
      style={{
        left:    frame.x,
        top:     frame.y,
        width:   frame.w,
        outline: selected ? '1px solid var(--kol-accent-primary)' : 'none',
        outlineOffset: '2px',
      }}
      onMouseDown={(e) => {
        /* Skip drag-start while axis-on is in edit mode; basic branch is
           already guarded by TypeBlock stopping propagation when editing. */
        if (axisEditing) return
        onMouseDown(e, frame)
      }}
    >
      {!axisActive && (
        <TypeBlock
          value={frame}
          selected={selected}
          onChange={onUpdate}
        />
      )}

      {axisActive && (
        <div style={{ display: 'grid' }}>
          {/* Visible axis layer — pointer-events: none so double-clicks
              fall through to the editable layer underneath. */}
          {showMorph && (
            <div
              aria-hidden
              style={{
                gridArea:      '1 / 1',
                textAlign:     baseStyle.textAlign,
                pointerEvents: 'none',
                position:      'relative',
                zIndex:        1,
              }}
            >
              <MorphedText
                text={display}
                width1={frame.width}   weight1={frame.weight}  italic1={frame.italic}
                width2={frame.width2}  weight2={frame.weight2} italic2={frame.italic}
                blend={frame.blend}
                curve={frame.axisCurve ?? 'flat'}
                cp1={frame.curveCp1 ?? { x: 0.33, y: 0.33 }}
                cp2={frame.curveCp2 ?? { x: 0.66, y: 0.66 }}
                size={frame.size}
                color={frame.color}
                fallbackStyle={{
                  ...baseStyle,
                  fontFamily: `'${familyFor(frame.width)}', 'Right Grotesk', sans-serif`,
                  color:      frame.color,
                  textTransform,
                }}
              />
            </div>
          )}

          {showRandom && (
            <div
              aria-hidden
              style={{
                ...baseStyle,
                gridArea:      '1 / 1',
                color:         frame.color,
                textTransform,
                pointerEvents: 'none',
                position:      'relative',
                zIndex:        1,
              }}
            >
              {Array.from(display).map((ch, i) => {
                const [w, wt] = pickCutFor(i, seed, {
                  widthLock:  frame.randomWidthLock,
                  weightLock: frame.randomWeightLock,
                })
                return (
                  <span
                    key={i}
                    style={{
                      fontFamily: `'${familyFor(w)}', 'Right Grotesk', sans-serif`,
                      fontWeight: wt,
                    }}
                  >
                    {ch}
                  </span>
                )
              })}
            </div>
          )}

          {showFade && (
            <>
              <div
                aria-hidden
                style={{
                  ...baseStyle,
                  gridArea:      '1 / 1',
                  fontFamily:    `'${familyFor(frame.width)}', 'Right Grotesk', sans-serif`,
                  color:         frame.color,
                  textTransform,
                  opacity:       1 - frame.blend,
                  pointerEvents: 'none',
                  position:      'relative',
                  zIndex:        1,
                }}
              >
                {display}
              </div>
              <div
                aria-hidden
                style={{
                  ...baseStyle,
                  gridArea:      '1 / 1',
                  fontFamily:    `'${familyFor(frame.width2)}', 'Right Grotesk', sans-serif`,
                  fontWeight:    frame.weight2,
                  color:         frame.color,
                  textTransform,
                  opacity:       frame.blend,
                  pointerEvents: 'none',
                  position:      'relative',
                  zIndex:        1,
                }}
              >
                {display}
              </div>
            </>
          )}

          {/* Hidden contentEditable layer for double-click commit. Becomes
            * opaque (visible) only while editing. */}
          <div
            ref={axisTextRef}
            contentEditable={axisEditing}
            suppressContentEditableWarning
            onDoubleClick={handleAxisDoubleClick}
            onBlur={handleAxisBlur}
            onKeyDown={handleAxisKeyDown}
            spellCheck={false}
            style={{
              ...baseStyle,
              gridArea:      '1 / 1',
              fontFamily:    `'${familyFor(frame.width)}', 'Right Grotesk', sans-serif`,
              color:         frame.color,
              textTransform,
              opacity:       axisEditing ? 1 : 0,
              userSelect:    axisEditing ? 'text' : 'none',
              position:      'relative',
              zIndex:        2,
            }}
          >
            {axisEditing ? frame.text : display}
          </div>
        </div>
      )}

      {selected && showMorph && (
        <CurveOverlay
          width={frame.w}
          height={frame.size * 1.2}
          curve={frame.axisCurve ?? 'flat'}
          blend={frame.blend}
          cp1={frame.curveCp1 ?? { x: 0.33, y: 0.33 }}
          cp2={frame.curveCp2 ?? { x: 0.66, y: 0.66 }}
        />
      )}

      {selected && (
        <>
          <TypeBlockToolbar value={frame} onChange={onUpdate} onRemove={onDelete} referenceElement={frameEl} />

          {frame.axisOn && (
            <div
              data-role="blend-track"
              className="absolute"
              style={{
                left:   0,
                right:  0,
                bottom: -22,
                height: 2,
                background: 'rgba(255, 255, 255, 0.16)',
                pointerEvents: 'none',
              }}
            >
              <div
                data-role="blend-handle"
                style={{
                  position:  'absolute',
                  top:       -6,
                  left:      `${frame.blend * 100}%`,
                  transform: 'translateX(-50%)',
                  width:     14,
                  height:    14,
                  borderRadius: 999,
                  background:   'var(--kol-accent-primary)',
                  border:       '2px solid white',
                  cursor:       'ew-resize',
                  pointerEvents: 'auto',
                  boxShadow:    '0 1px 4px rgba(0,0,0,0.4)',
                }}
              />
            </div>
          )}

          {/* Right-edge resize handle. */}
          <div
            data-role="resize-handle"
            data-direction="E"
            className="absolute"
            style={{
              right:        -8,
              top:          '50%',
              transform:    'translateY(-50%)',
              width:        12,
              height:       28,
              cursor:       'ew-resize',
              background:   'var(--kol-accent-primary)',
              borderRadius: 2,
            }}
          />
          {/* Left-edge resize handle. */}
          <div
            data-role="resize-handle"
            data-direction="W"
            className="absolute"
            style={{
              left:         -8,
              top:          '50%',
              transform:    'translateY(-50%)',
              width:        12,
              height:       28,
              cursor:       'ew-resize',
              background:   'var(--kol-accent-primary)',
              borderRadius: 2,
            }}
          />
        </>
      )}
    </div>
  )
}
