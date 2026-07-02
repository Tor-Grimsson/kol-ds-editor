// Shared gradient palette/backdrop enums — data-only (imported by the
// catalog eagerly and by the engines lazily; keep three out of here).
export const GRAD_PALETTES = [
  { value: 'spectrum', label: 'Spectrum', cols: ['#2541b2', '#7b2ff7', '#ff3864', '#ff8c42', '#ffd23f'] },
  { value: 'iris', label: 'Iris', cols: ['#0b1e7a', '#5b2a9e', '#c81d77', '#ff7b54', '#ffe66d'] },
  { value: 'aqua', label: 'Aqua', cols: ['#06113c', '#0353a4', '#2ec4b6', '#80ffdb', '#e0fbfc'] },
  { value: 'magma', label: 'Magma', cols: ['#0d0221', '#5f0f40', '#fb8b24', '#e36414', '#ffd23f'] },
  { value: 'candy', label: 'Candy', cols: ['#2b2bff', '#11d6c9', '#9bff8a', '#ffd34e', '#ff5fa2'] },
]

// Dark backdrops behind the forms.
export const BACKDROPS = [
  { value: 'black', label: 'Black', col: '#000000' },
  { value: 'ink', label: 'Ink', col: '#0a0612' },
  { value: 'abyss', label: 'Abyss', col: '#04101c' },
  { value: 'plum', label: 'Plum', col: '#140a1e' },
]
