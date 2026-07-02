/**
 * Pattern-layer param schema — the simple knobs of the pattern surface
 * (Phase 1 breadth). Bespoke UI stays hand-wired in LayerInspector: the
 * saved-pattern picker, the rules editor, and the library / Pattern-mode /
 * flatten actions.
 *
 * Integer grid counts are non-animatable (same policy as shape's sides:
 * integer morphs read as jank); continuous px knobs animate.
 */
import { SHAPE_OPTIONS } from '../../modes/pattern/shapes'

export const PATTERN_SCHEMA = [
  { key: 'shapeId',   label: 'Shape',       type: 'select', default: SHAPE_OPTIONS[0]?.value, options: SHAPE_OPTIONS },
  { key: 'customSvg', label: 'Custom SVG',  type: 'text',   default: '', rows: 3,
    placeholder: '<svg viewBox="0 0 24 24">…</svg>', when: (l) => l.shapeId === 'custom' },
  { key: 'cols',      label: 'Cols',        type: 'range', min: 1, max: 32, step: 1, default: 6,  format: (v) => `${v}`, animatable: false, section: 'Grid' },
  { key: 'rows',      label: 'Rows',        type: 'range', min: 1, max: 32, step: 1, default: 6,  format: (v) => `${v}`, animatable: false, section: 'Grid' },
  { key: 'gap',       label: 'Gap',         type: 'range', min: -64, max: 64, step: 1, default: 0, format: (v) => `${v}px`, section: 'Grid' },
  { key: 'padding',   label: 'Padding',     type: 'range', min: -128, max: 128, step: 1, default: 0, format: (v) => `${v}px`, section: 'Grid' },
  { key: 'stretch',   label: 'Stretch',     type: 'toggle', default: false, section: 'Tile' },
  { key: 'overflow',  label: 'Overflow',    type: 'toggle', default: false, labels: ['Clip', 'Visible'], section: 'Tile' },
  { key: 'scale',     label: 'Tile size',   type: 'range', min: 64, max: 1024, step: 16, default: 256, format: (v) => `${v}px`, section: 'Tile' },
  { key: 'bgOn',      label: 'Tile bg',     type: 'toggle', default: false, section: 'Color' },
  { key: 'bg',        label: 'Tile bg color', type: 'color', default: null, when: (l) => !!l.bgOn, section: 'Color' },
]
