/**
 * Text-layer param schema — the typography surface (Phase 1 breadth).
 * Bespoke UI stays hand-wired in LayerInspector: the saved-spec picker and
 * the Type-mode / flatten actions.
 */
import { WIDTHS, WEIGHTS, CASES } from '../../modes/type/cuts'

const WIDTH_OPTIONS  = WIDTHS.map((w)  => ({ value: w.id, label: w.label }))
const WEIGHT_OPTIONS = WEIGHTS.map((w) => ({ value: w.id, label: w.label }))
const CASE_OPTIONS   = CASES.map((c)   => ({ value: c.id, label: c.label }))
const ALIGN_OPTIONS  = [
  { value: 'left',   label: 'Left'   },
  { value: 'center', label: 'Center' },
  { value: 'right',  label: 'Right'  },
]

export const TEXT_SCHEMA = [
  { key: 'text',       label: 'Content', type: 'text',   default: '', rows: 2 },
  { key: 'width',      label: 'Cut',     type: 'select', default: 'Tight',    options: WIDTH_OPTIONS, section: 'Font' },
  { key: 'weight',     label: 'Weight',  type: 'select', default: 600,        options: WEIGHT_OPTIONS, numeric: true, section: 'Font' },
  { key: 'case',       label: 'Case',    type: 'select', default: 'original', options: CASE_OPTIONS, section: 'Font' },
  { key: 'italic',     label: 'Italic',  type: 'toggle', default: false, section: 'Font' },
  { key: 'textAlign',  label: 'Align',   type: 'select', default: 'center',   options: ALIGN_OPTIONS, section: 'Layout' },
  { key: 'size',       label: 'Size',    type: 'range', min: 12, max: 400, step: 1, default: 96, format: (v) => `${v}px`, section: 'Layout' },
  { key: 'tracking',   label: 'Tracking', type: 'range', min: -0.05, max: 0.2, step: 0.005, default: 0, format: (v) => `${v.toFixed(3)}em`, section: 'Layout' },
  { key: 'lineHeight', label: 'Leading', type: 'range', min: 0.85, max: 2.0, step: 0.05, default: 1.05, format: (v) => v.toFixed(2), section: 'Layout' },
]
