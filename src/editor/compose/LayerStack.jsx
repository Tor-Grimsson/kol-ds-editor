import { useRef, useState } from 'react'
import EditorIcon from '../icons/EditorIcon'
import EditorButton from '../components/EditorButton'
import { Input } from '@kolkrabbi/kol-component'
import { Dropdown, MenuDropdownItem, MenuDropdownNest, usePopover, PopoverPanel } from '@kolkrabbi/kol-component'
import { useComposeState, LAYER_TYPES } from './state'
import { rowLabelForLayer } from './labels'

/**
 * Layer stack — left rail of the editor.
 *
 * Z-stacked render elements with HTML5 drag-to-reorder and a per-row
 * chevron that expands a "blending" sub-panel (visibility + opacity +
 * blend mode). Compact mode keeps the row tight; expanded gives quick
 * access to the per-layer toggles without round-tripping through the
 * inspector. Frame-level config (aspect) lives in the topbar Canvas menu.
 */

/* Layer-type icon names — resolved by `EditorIcon` against
 * `src/editor/icons/svg/`. Edit-iterate the visual without touching the
 * shared DS icon registry. */
const TYPE_ICONS = {
  background: 'layer-background',
  pattern:    'layer-pattern',
  photo:      'layer-photo',
  shape:      'layer-shape',
  text:       'layer-text',
  group:      'layer-group',
}

const BLEND_MODES = [
  { value: 'normal',     label: 'Normal' },
  { value: 'multiply',   label: 'Multiply' },
  { value: 'screen',     label: 'Screen' },
  { value: 'overlay',    label: 'Overlay' },
  { value: 'soft-light', label: 'Soft light' },
  { value: 'difference', label: 'Difference' },
]

function LayerRow({
  layer, active, palette,
  groupCollapsed, onToggleGroup,
  onSelect, onShiftSelect, onToggleVisibility, onToggleLock,
  draggedId, dropTargetId, dropPosition,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}) {
  const isGroup = layer.type === 'group'

  const isDragging  = draggedId === layer.id
  const isDropAbove = dropTargetId === layer.id && dropPosition === 'above'
  const isDropBelow = dropTargetId === layer.id && dropPosition === 'below'

  const selectHandlers = useShiftClickHandlers(onSelect, onShiftSelect)

  return (
    <div className="kol-compose-layer-line group">
      {isGroup ? (
        <button
          type="button"
          onClick={onToggleGroup}
          aria-expanded={!groupCollapsed}
          title={groupCollapsed ? 'Expand group' : 'Collapse group'}
          className="kol-compose-layer-collapse"
        >
          <EditorIcon
            name="chevron-down"
            size={10}
            style={{ transform: groupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
          />
        </button>
      ) : (
        <span aria-hidden="true" className="kol-compose-layer-collapse" />
      )}
      <div
        draggable
        onDragStart={(e) => onDragStart(e, layer.id)}
        onDragOver={(e) => onDragOver(e, layer.id)}
        onDragLeave={(e) => onDragLeave(e, layer.id)}
        onDrop={(e) => onDrop(e, layer.id)}
        onDragEnd={onDragEnd}
        className={
          `kol-compose-layer-row${active ? ' is-active' : ''}` +
          `${!layer.visible ? ' is-hidden' : ''}` +
          `${isDragging ? ' is-dragging' : ''}` +
          `${isDropAbove ? ' is-drop-above' : ''}` +
          `${isDropBelow ? ' is-drop-below' : ''}`
        }
        data-layer-id={layer.id}
      >
        <button
          type="button"
          onMouseDown={selectHandlers.onMouseDown}
          onClick={selectHandlers.onClick}
          className="kol-compose-layer-main"
        >
          <span className="kol-compose-layer-btn-icon" aria-hidden="true">
            <EditorIcon name={TYPE_ICONS[layer.type] ?? 'layer-shape'} size={14} />
          </span>
          <span className="kol-helper-12 truncate flex-1 text-left">
            {rowLabelForLayer(layer)}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleLock}
          title={layer.locked ? 'Unlock' : 'Lock'}
          aria-pressed={!!layer.locked}
          className={`absolute inset-y-0 right-7 w-7 inline-flex items-center justify-center rounded text-meta hover:text-emphasis hover:bg-fg-08 transition-opacity ${layer.locked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <EditorIcon name={layer.locked ? 'lock' : 'unlock'} size={12} />
        </button>
        <button
          type="button"
          onClick={onToggleVisibility}
          title={layer.visible ? 'Hide' : 'Show'}
          aria-pressed={!layer.visible}
          className={`absolute inset-y-0 right-0 w-7 inline-flex items-center justify-center rounded text-meta hover:text-emphasis hover:bg-fg-08 transition-opacity ${!layer.visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <EditorIcon name={layer.visible ? 'eye-on' : 'eye-off'} size={12} />
        </button>
      </div>
    </div>
  )
}

/* Shift state captured in mousedown via ref; click reads the ref to decide
 * single-select vs toggle-select. Avoids relying on the synthetic event's
 * shiftKey passing through (proved unreliable in this codebase). */
function useShiftClickHandlers(onSelect, onShiftSelect) {
  const shiftRef = useRef(false)
  const onMouseDown = (e) => { shiftRef.current = !!e.shiftKey }
  const onClick = (e) => {
    if (shiftRef.current) {
      shiftRef.current = false
      onShiftSelect?.()
    } else {
      onSelect?.()
    }
  }
  return { onMouseDown, onClick }
}

/* AddLayerButton — `+` button opens a Popover listing the layer types.
 * Positioning, portal, outside-click, Esc, and scroll/resize tracking are
 * delegated to floating-ui via the Popover molecule. The Shape entry
 * expands inline to a kind picker (Logo / Rect / Ellipse / Triangle /
 * Line / Polygon / Star) so adding "a shape" doesn't silently default to
 * logo. */
const MENU_WIDTH = 180

/* Line is intentionally NOT in this list — line creation is pen-tool only
 * (click-click on the canvas with the Line tool) so endpoints + slope
 * carry direction information that a default-bbox add can't provide.
 * Switching an existing shape's kind to 'line' via the inspector is
 * still allowed (just defaults to a '\' diagonal). */
const SHAPE_KINDS = [
  { id: 'logo',     label: 'Logo',      icon: 'layer-shape',   extras: {} },
  { id: 'rect',     label: 'Rectangle', icon: 'tool-rect',     extras: { kind: 'rect' } },
  { id: 'ellipse',  label: 'Ellipse',   icon: 'tool-ellipse',  extras: { kind: 'ellipse' } },
  { id: 'triangle', label: 'Triangle',  icon: 'tool-triangle', extras: { kind: 'triangle' } },
  { id: 'polygon',  label: 'Polygon',   icon: 'tool-polygon',  extras: { kind: 'polygon', sides: 5 } },
  { id: 'star',     label: 'Star',      icon: 'tool-star',     extras: { kind: 'star', points: 5, innerRatio: 0.5 } },
]

function AddLayerButton({ addLayer }) {
  const [open, setOpen] = useState(false)
  const popover = usePopover({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-start',
    offset: 4,
    role: 'menu',
  })

  return (
    <>
      <span
        ref={popover.refs.setReference}
        {...popover.getReferenceProps()}
        className="inline-flex"
      >
        <EditorButton
          variant="primary"
          size="sm"
          animateIcon
          quiet
          iconOnly="plus"
          iconSize={12}
          aria-label="Add layer"
          title="Add layer"
          style={{ padding: 6 }}
        />
      </span>
      <PopoverPanel popover={popover} className="py-1" style={{ width: MENU_WIDTH }}>
        {LAYER_TYPES.map((t) => {
          if (t.id === 'shape') {
            return (
              <MenuDropdownNest
                key={t.id}
                iconLeft={<EditorIcon name={TYPE_ICONS.shape} size={12} />}
                label={t.label}
              >
                {SHAPE_KINDS.map((k) => (
                  <MenuDropdownItem
                    key={k.id}
                    iconLeft={<EditorIcon name={k.icon} size={12} />}
                    onClick={() => { addLayer('shape', k.extras); setOpen(false) }}
                  >
                    {k.label}
                  </MenuDropdownItem>
                ))}
              </MenuDropdownNest>
            )
          }
          return (
            <MenuDropdownItem
              key={t.id}
              iconLeft={<EditorIcon name={TYPE_ICONS[t.id] ?? 'layer-shape'} size={12} />}
              onClick={() => { addLayer(t.id); setOpen(false) }}
            >
              {t.label}
            </MenuDropdownItem>
          )
        })}
      </PopoverPanel>
    </>
  )
}

/* CanvasRow — bottom-most row in the layer stack, representing the canvas
 * itself. Always present, can't be deleted. Selecting it routes the
 * inspector to CanvasInspector (fill / opacity). */
/* CanvasRow — parent of every other layer, always rendered at the top of
 * the stack. The chevron toggles showing / hiding all child layers below.
 * Selecting Canvas routes the inspector to CanvasInspector. */
function CanvasRow({ active, collapsed, onToggleCollapse, onSelect }) {
  return (
    <div className="kol-compose-layer-line group">
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
        title={collapsed ? 'Expand layers' : 'Collapse layers'}
        className="kol-compose-layer-collapse"
      >
        <EditorIcon
          name="chevron-down"
          size={10}
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
        />
      </button>
      <div
        className={`kol-compose-layer-row${active ? ' is-active' : ''}`}
        data-layer-id="canvas"
      >
        <button
          type="button"
          onClick={onSelect}
          className="kol-compose-layer-main"
        >
          <span className="kol-compose-layer-btn-icon" aria-hidden="true">
            <EditorIcon name="maximize" size={14} />
          </span>
          <span className="kol-mono-12 truncate flex-1 text-left">Canvas</span>
        </button>
      </div>
    </div>
  )
}

function ChildRow({ layer, active, onSelect, onShiftSelect }) {
  const handlers = useShiftClickHandlers(onSelect, onShiftSelect)
  return (
    <div className="kol-compose-layer-line">
      <span aria-hidden="true" className="kol-compose-layer-collapse" />
      <button
        type="button"
        onMouseDown={handlers.onMouseDown}
        onClick={handlers.onClick}
        className={`kol-compose-layer-row${active ? ' is-active' : ''}`}
        data-layer-id={layer.id}
      >
        <span className="kol-compose-layer-main">
          <span className="kol-compose-layer-btn-icon" aria-hidden="true">
            <EditorIcon name={TYPE_ICONS[layer.type] ?? 'layer-shape'} size={14} />
          </span>
          <span className="kol-helper-12 truncate flex-1 text-left">
            {rowLabelForLayer(layer)}
          </span>
        </span>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
    </div>
  )
}

export default function LayerStack() { return <LayerStackBody /> }

export function LayerStackBody() {
  const {
    selectedId, selectedIds, select, selectCanvas, toggleSelection, groupLayers,
    layers, addLayer, removeLayer, deleteSelected, toggleLayer, toggleLayerLock, moveLayer,
    palette,
  } = useComposeState()

  /* Multi-selected *layer* count (the aspect frame slot doesn't count
   * toward grouping). */
  /* `canvas` is selectable but isn't a layer — exclude it from group-action
   * counting and the groupLayers payload. */
  const layerSelectedIds    = selectedIds.filter((id) => id !== 'canvas')
  const layerSelectionCount = layerSelectedIds.length

  const [draggedId, setDraggedId]       = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const [dropPosition, setDropPosition] = useState(null)
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set())
  const [canvasCollapsed, setCanvasCollapsed] = useState(false)

  const toggleGroupCollapse = (id) => setCollapsedGroups((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const onDragStart = (e, id) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    setDraggedId(id)
  }

  const onDragOver = (e, targetId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (!draggedId || draggedId === targetId) {
      setDropTargetId(null)
      setDropPosition(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const isUpper = (e.clientY - rect.top) < rect.height / 2
    setDropTargetId(targetId)
    setDropPosition(isUpper ? 'above' : 'below')
  }

  const onDragLeave = (_e, targetId) => {
    setDropTargetId((cur) => (cur === targetId ? null : cur))
  }

  const onDrop = (e, targetId) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) {
      clearDrag()
      return
    }
    const fromIndex   = layers.findIndex((l) => l.id === draggedId)
    const targetIndex = layers.findIndex((l) => l.id === targetId)
    if (fromIndex < 0 || targetIndex < 0) {
      clearDrag()
      return
    }
    const targetAfterRemoval = fromIndex < targetIndex ? targetIndex - 1 : targetIndex
    const finalIndex = dropPosition === 'above' ? targetAfterRemoval + 1 : targetAfterRemoval
    moveLayer(draggedId, finalIndex)
    clearDrag()
  }

  const clearDrag = () => {
    setDraggedId(null)
    setDropTargetId(null)
    setDropPosition(null)
  }

  const onDragEnd = clearDrag

  const onDeleteSelected = deleteSelected
  const hasLayerSelection = selectedIds.some((id) => id !== 'canvas')

  return (
    <div className="kol-compose-rail min-h-[240px]" data-layer-stack="true">
      <ul className="flex flex-col pb-3 px-4 pt-3">
        <li>
          <CanvasRow
            active={selectedIds.includes('canvas')}
            collapsed={canvasCollapsed}
            onToggleCollapse={() => setCanvasCollapsed((v) => !v)}
            onSelect={selectCanvas}
          />
        </li>
        {!canvasCollapsed && [...layers].reverse().map((layer) => (
          <li key={layer.id} className="kol-compose-layer-nest">
            <LayerRow
              layer={layer}
              active={selectedIds.includes(layer.id)}
              palette={palette}
              groupCollapsed={collapsedGroups.has(layer.id)}
              onToggleGroup={() => toggleGroupCollapse(layer.id)}
              onSelect={() => select(layer.id)}
              onShiftSelect={() => toggleSelection(layer.id)}
              onToggleVisibility={() => toggleLayer(layer.id)}
              onToggleLock={() => toggleLayerLock(layer.id)}
              draggedId={draggedId}
              dropTargetId={dropTargetId}
              dropPosition={dropPosition}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
            {layer.type === 'group' && !collapsedGroups.has(layer.id) && Array.isArray(layer.children) && layer.children.length > 0 && (
              <ul className="flex flex-col kol-compose-layer-nest">
                {[...layer.children].reverse().map((child) => (
                  <li key={child.id}>
                    <ChildRow
                      layer={child}
                      active={selectedIds.includes(child.id) || selectedIds.includes(layer.id)}
                      onSelect={() => select(child.id)}
                      onShiftSelect={() => toggleSelection(child.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center gap-2 px-3 h-10 border-t border-fg-08">
        {layerSelectionCount >= 2 && (
          <EditorButton
            variant="primary"
            size="sm"
            iconLeft="component"
            iconSize={12}
            onClick={() => groupLayers(layerSelectedIds)}
            title={`Group ${layerSelectionCount} selected layers`}
          >
            Group {layerSelectionCount}
          </EditorButton>
        )}
        <div className="ml-auto flex items-center gap-2">
          <AddLayerButton addLayer={addLayer} />
          <EditorButton
            variant="primary"
            size="sm"
            animateIcon
            quiet
            iconOnly="trash"
            iconSize={12}
            aria-label="Delete selected"
            title="Delete selected"
            disabled={!hasLayerSelection}
            onClick={onDeleteSelected}
            style={{ padding: 6 }}
          />
        </div>
      </div>
    </div>
  )
}
