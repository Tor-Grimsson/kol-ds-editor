/**
 * Right Grotesk weights + cut helpers — shared between the Type Lab editor
 * and DS / styleguide consumers (TypeBlockToolbar, TypeBlock).
 *
 * Lifted out of `editor/modes/type/cuts.js` so DS + framework no longer
 * reach into the editor for these shared utilities (phase 7 backwards-dep
 * cleanup). Type-lab's `cuts.js` re-exports from here.
 */

export const WEIGHTS = [
  { id: 100, label: 'Fine'    },
  { id: 300, label: 'Light'   },
  { id: 400, label: 'Regular' },
  { id: 500, label: 'Medium'  },
  { id: 600, label: 'Dark'    },
  { id: 700, label: 'Bold'    },
  { id: 900, label: 'Black'   },
]

export const familyFor = (width) => {
  if (width === 'mono') return 'JetBrains Mono'
  if (width === 'base') return 'Right Grotesk'
  return `Right Grotesk ${width}`
}

export const applyCase = (text, c) => {
  if (c === 'upper')    return text.toUpperCase()
  if (c === 'lower')    return text.toLowerCase()
  if (c === 'sentence') return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
  return text
}
