import { useEffect, useRef, useState } from 'react'
import { familyFor, applyCase } from '../../data/typography-cuts'

/**
 * TypeBlock — typography block organism (basic mode).
 *
 * Renders a single `<div>` styled with the value's typography props (Right
 * Grotesk family + cut, weight, italic, size, tracking, line-height, case,
 * color, alignment). When `selected` and the user double-clicks, enters
 * contentEditable mode; Escape or blur commits the text via
 * `onChange({ text })`. Deselecting while editing also commits.
 *
 * **Position is the consumer's job.** TypeBlock does NOT own absolute
 * positioning, outlines, resize handles, or drag chrome. It's a typography
 * rendering primitive — the parent wraps it in whatever positioned
 * container makes sense (Type Lab's TypeFrame wrapper, compose's layer
 * wrapper, /components showcase tile, etc.).
 *
 * Mousedown bubbles via `onMouseDown` so the parent's drag-start handler
 * fires only when not currently editing.
 *
 * Does NOT cover axis-morph rendering (morph/random/fade modes) — those
 * are Type-Lab-specific advanced behaviors. Type Lab's TypeFrame composes
 * TypeBlock for the basic branch and renders custom branches when axisOn.
 *
 * Props:
 *   value         { text, width, weight, italic, size, tracking, lineHeight,
 *                   case, color, textAlign } — typography props
 *   selected      enables contentEditable on double-click
 *   onMouseDown   bubbles to parent for drag-start (no-op while editing)
 *   onChange      partial-patch updates (e.g. { text: 'new value' })
 *   className     extra classes for the rendered text div
 */
export default function TypeBlock({
  value,
  selected = false,
  onMouseDown,
  onChange,
  className = '',
}) {
  const textRef = useRef(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus()
      const range = document.createRange()
      range.selectNodeContents(textRef.current)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }
  }, [editing])

  useEffect(() => {
    if (!selected && editing) {
      commitText()
      setEditing(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const commitText = () => {
    if (!textRef.current) return
    const next = textRef.current.innerText
    if (next !== value.text) onChange?.({ text: next })
  }

  const handleDoubleClick = (e) => {
    e.stopPropagation()
    if (selected) setEditing(true)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      commitText()
      setEditing(false)
    }
  }

  const handleBlur = () => {
    commitText()
    setEditing(false)
  }

  const display = editing ? value.text : applyCase(value.text, value.case)
  const textTransform = editing
    ? 'none'
    : (value.case === 'upper' ? 'uppercase' : value.case === 'lower' ? 'lowercase' : 'none')

  return (
    <div
      ref={textRef}
      contentEditable={editing}
      suppressContentEditableWarning
      onDoubleClick={handleDoubleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => {
        if (editing) {
          /* Don't bubble — parent uses mousedown to start canvas drag,
             which would interrupt the caret-positioning click inside
             the contentEditable text. */
          e.stopPropagation()
          return
        }
        onMouseDown?.(e)
      }}
      spellCheck={false}
      className={className}
      style={{
        fontFamily:    `'${familyFor(value.width)}', 'Right Grotesk', sans-serif`,
        fontWeight:    value.weight,
        fontStyle:     value.italic ? 'italic' : 'normal',
        fontSize:      `${value.size}px`,
        letterSpacing: `${value.tracking}em`,
        lineHeight:    value.lineHeight,
        textAlign:     value.textAlign ?? 'center',
        color:         value.color,
        WebkitTextStrokeColor: value.strokeColor || undefined,
        WebkitTextStrokeWidth: value.strokeWidth > 0 && value.strokeColor ? `${value.strokeWidth}px` : undefined,
        paintOrder:    value.strokeWidth > 0 && value.strokeColor ? 'stroke fill' : undefined,
        textTransform,
        outline:       'none',
        minHeight:     '1em',
        overflowWrap:  'break-word',
        whiteSpace:    'pre-wrap',
        cursor:        editing ? 'text' : (selected ? 'move' : 'pointer'),
        userSelect:    editing ? 'text' : 'none',
      }}
    >
      {display}
    </div>
  )
}
