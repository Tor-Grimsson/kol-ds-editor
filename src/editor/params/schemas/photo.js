/**
 * Photo-layer param schema (Phase 1 breadth). Source upload / preview /
 * clear stays hand-wired in LayerInspector (file input + object lifecycle,
 * not a tunable knob).
 */
export const PHOTO_SCHEMA = [
  { key: 'fit', label: 'Fit', type: 'select', default: 'cover',
    options: [
      { value: 'cover',   label: 'Cover' },
      { value: 'contain', label: 'Contain' },
      { value: 'fill',    label: 'Fill' },
    ] },
]
