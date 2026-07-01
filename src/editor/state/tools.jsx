import { createContext, useContext, useState } from 'react'

/**
 * Active editor tool — pointer mode for the canvas. One global value across
 * all modes; `select` is the default and the only one that supports the
 * existing select / drag / resize gestures. Other tools enter create mode:
 * mousedown + drag commits a new layer of the matching type.
 *
 * After a non-Select tool commits, the editor flips back to Select so the
 * user immediately gets normal selection gestures on the freshly-created
 * layer.
 */
export const TOOLS = ['select', 'text', 'pen', 'rect', 'ellipse', 'triangle', 'line', 'polygon', 'star', 'pattern', 'zoom']

export const TOOL_META = {
  select:   { id: 'select',   label: 'Select',     icon: 'tool-cursor',   shortcut: 'V' },
  text:     { id: 'text',     label: 'Text',       icon: 'tool-text',     shortcut: 'T' },
  pen:      { id: 'pen',      label: 'Pen',        icon: 'tool-pen',      shortcut: 'P' },
  rect:     { id: 'rect',     label: 'Rectangle',  icon: 'tool-rect',     shortcut: 'R' },
  ellipse:  { id: 'ellipse',  label: 'Ellipse',    icon: 'tool-ellipse',  shortcut: 'O' },
  triangle: { id: 'triangle', label: 'Triangle',   icon: 'tool-triangle', shortcut: '' },
  line:     { id: 'line',     label: 'Line',       icon: 'tool-line',     shortcut: '' },
  polygon:  { id: 'polygon',  label: 'Polygon',    icon: 'tool-polygon',  shortcut: '' },
  star:     { id: 'star',     label: 'Star',       icon: 'tool-star',     shortcut: '' },
  pattern:  { id: 'pattern',  label: 'Pattern',    icon: 'tool-pattern',  shortcut: '' },
  /* Zoom is a viewport tool, not a create tool — click zooms in at the
   * pointer, Alt+click zooms out. Never commits a layer. */
  zoom:     { id: 'zoom',     label: 'Zoom',       icon: 'zoom',          shortcut: 'Z' },
}

const ToolContext = createContext(null)

export function ToolProvider({ children }) {
  const [tool, setTool] = useState('select')
  return <ToolContext.Provider value={{ tool, setTool }}>{children}</ToolContext.Provider>
}

export function useTool() {
  const ctx = useContext(ToolContext)
  if (!ctx) return { tool: 'select', setTool: () => {} }
  return ctx
}
