/* Single source of truth for human-readable layer labels.
 *
 * Convention: Title Case everywhere. Layer rows, inspector titles, add-menu
 * options, library item names, dropdown labels — all read from this file. */

export const TYPE_LABELS = {
  background: 'Background',
  pattern:    'Pattern',
  photo:      'Photo',
  shape:      'Shape',
  text:       'Text',
  group:      'Group',
}

export const SHAPE_KIND_LABELS = {
  logo:     'Logo',
  rect:     'Rectangle',
  ellipse:  'Ellipse',
  triangle: 'Triangle',
  line:     'Line',
  polygon:  'Polygon',
  star:     'Star',
  flatten:  'Flatten',
}

/* Inspector title — verbose form, e.g. "Shape · Rectangle". */
export function labelForLayer(layer) {
  if (layer.type === 'shape') {
    const kind = SHAPE_KIND_LABELS[layer.kind ?? 'logo'] ?? 'Shape'
    return `Shape · ${kind}`
  }
  return TYPE_LABELS[layer.type] ?? layer.type
}

/* Compact label for a layer-stack row. Shapes show their kind directly
 * (Figma idiom — "Rectangle" not "Shape · Rectangle"); text rows show
 * the actual content (truncated by the row's CSS). */
export function rowLabelForLayer(layer) {
  if (layer.type === 'text') return layer.text || TYPE_LABELS.text
  if (layer.type === 'shape') {
    return SHAPE_KIND_LABELS[layer.kind ?? 'logo'] ?? TYPE_LABELS.shape
  }
  return TYPE_LABELS[layer.type] ?? layer.type
}
