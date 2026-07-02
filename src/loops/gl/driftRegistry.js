// Drift catalog — single source of truth for the category's sub-pages.
// /drift is a router shell with one routed sub-page per entry; nav + routes both
// derive from this list so they can't drift (mirrors the scanlines/loops model).
//
// THREE families of the ONE shared DriftEngine; each entry carries its `family`
// (selects the engine's fragment shader) and seeds default params. Every page
// exposes the FULL control set for its family (the editor renders the rail from
// the family's control spec).

export const CATEGORIES = [
  { id: 'air', label: 'Air', route: '/drift' },
  { id: 'water', label: 'Water', route: '/drift/water' },
  { id: 'cloth', label: 'Cloth', route: '/drift/cloth' },
]
export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0]

// `path` is relative to /drift ('' = the Air index = the category root); each
// family's first entry owns its category root. `route` is the absolute link.
export const SUBPAGES = {
  air: [
    { id: 'clouds', label: 'Clouds', path: '', route: '/drift', family: 'air',
      defaults: { style: 'clouds', palette: 'overcast', freq: 1.0, warp: 1.6, evolve: 0.16, direction: 25, wind: 0.22, coverage: 0.6, soft: 0.6, contrast: 1.1, sheen: 0.4, grain: 0.03, period: 8 } },
    { id: 'cumulus', label: 'Cumulus', path: 'cumulus', route: '/drift/cumulus', family: 'air',
      defaults: { style: 'clouds', palette: 'dusk', freq: 0.85, warp: 2.0, evolve: 0.14, direction: 15, wind: 0.18, coverage: 0.72, soft: 0.32, contrast: 1.25, sheen: 0.55, grain: 0.025, period: 10 } },
    { id: 'cirrus', label: 'Cirrus', path: 'cirrus', route: '/drift/cirrus', family: 'air',
      defaults: { style: 'cirrus', palette: 'dawn', freq: 1.8, warp: 1.2, evolve: 0.2, direction: 8, wind: 0.4, coverage: 0.5, soft: 0.7, contrast: 1.05, sheen: 0.3, grain: 0.02, period: 9 } },
    { id: 'storm', label: 'Storm', path: 'storm', route: '/drift/storm', family: 'air',
      defaults: { style: 'clouds', palette: 'storm', freq: 1.15, warp: 2.4, evolve: 0.32, direction: 40, wind: 0.5, coverage: 0.82, soft: 0.4, contrast: 1.45, sheen: 0.5, grain: 0.04, period: 6 } },
    { id: 'mist', label: 'Mist', path: 'mist', route: '/drift/mist', family: 'air',
      defaults: { style: 'clouds', palette: 'noir', freq: 0.7, warp: 1.3, evolve: 0.1, direction: 90, wind: 0.12, coverage: 0.42, soft: 0.85, contrast: 0.9, sheen: 0.2, grain: 0.035, period: 14 } },
    { id: 'aurora', label: 'Aurora', path: 'aurora', route: '/drift/aurora', family: 'air',
      defaults: { style: 'aurora', palette: 'aurora', freq: 1.1, warp: 1.6, evolve: 0.28, direction: 0, wind: 0.25, coverage: 0.65, soft: 0.7, contrast: 1.2, sheen: 0.6, grain: 0.02, period: 11 } },
  ],
  water: [
    { id: 'ocean', label: 'Ocean', path: 'water', route: '/drift/water', family: 'water',
      defaults: { style: 'waves', palette: 'ocean', freq: 1.0, amp: 0.8, chop: 0.5, foam: 0.35, evolve: 0.16, direction: 30, light: 60, sheen: 0.8, contrast: 1.1, grain: 0.02, period: 8 } },
    { id: 'ripples', label: 'Ripples', path: 'water/ripples', route: '/drift/water/ripples', family: 'water',
      defaults: { style: 'ripples', palette: 'pool', freq: 1.4, amp: 0.4, chop: 0.7, foam: 0.2, evolve: 0.22, direction: 20, light: 90, sheen: 0.6, contrast: 1.05, grain: 0.02, period: 7 } },
    { id: 'caustics', label: 'Caustics', path: 'water/caustics', route: '/drift/water/caustics', family: 'water',
      defaults: { style: 'caustics', palette: 'pool', freq: 1.0, amp: 0.5, chop: 0.8, foam: 0.2, evolve: 0.2, direction: 0, light: 80, sheen: 0.6, contrast: 1.2, grain: 0.02, period: 9 } },
    { id: 'lake', label: 'Lake', path: 'water/lake', route: '/drift/water/lake', family: 'water',
      defaults: { style: 'waves', palette: 'lake', freq: 0.8, amp: 0.4, chop: 0.25, foam: 0.1, evolve: 0.1, direction: 45, light: 70, sheen: 0.5, contrast: 1.0, grain: 0.025, period: 12 } },
    { id: 'tide', label: 'Tide', path: 'water/tide', route: '/drift/water/tide', family: 'water',
      defaults: { style: 'waves', palette: 'sunset', freq: 0.9, amp: 1.0, chop: 0.5, foam: 0.4, evolve: 0.18, direction: 10, light: 30, sheen: 0.9, contrast: 1.15, grain: 0.02, period: 9 } },
    { id: 'ink', label: 'Ink', path: 'water/ink', route: '/drift/water/ink', family: 'water',
      defaults: { style: 'waves', palette: 'ink', freq: 1.1, amp: 0.7, chop: 0.6, foam: 0.15, evolve: 0.2, direction: 50, light: 80, sheen: 1.0, contrast: 1.3, grain: 0.03, period: 8 } },
  ],
  cloth: [
    { id: 'silk', label: 'Silk', path: 'cloth', route: '/drift/cloth', family: 'cloth',
      defaults: { style: 'folds', palette: 'silk', freq: 1.0, fold: 0.7, drape: 0.5, sway: 0.5, evolve: 0.14, direction: 70, light: 50, sheen: 1.0, contrast: 1.1, grain: 0.015, period: 9 } },
    { id: 'flag', label: 'Flag', path: 'cloth/flag', route: '/drift/cloth/flag', family: 'cloth',
      defaults: { style: 'flag', palette: 'royal', freq: 0.9, fold: 0.8, drape: 0.4, sway: 0.8, evolve: 0.18, direction: 0, light: 40, sheen: 0.7, contrast: 1.15, grain: 0.02, period: 6 } },
    { id: 'drape', label: 'Drape', path: 'cloth/drape', route: '/drift/cloth/drape', family: 'cloth',
      defaults: { style: 'drape', palette: 'velvet', freq: 0.8, fold: 0.6, drape: 0.9, sway: 0.3, evolve: 0.1, direction: 90, light: 60, sheen: 0.8, contrast: 1.2, grain: 0.02, period: 12 } },
    { id: 'banner', label: 'Banner', path: 'cloth/banner', route: '/drift/cloth/banner', family: 'cloth',
      defaults: { style: 'flag', palette: 'emerald', freq: 1.0, fold: 0.7, drape: 0.5, sway: 0.6, evolve: 0.16, direction: 10, light: 45, sheen: 0.7, contrast: 1.1, grain: 0.02, period: 8 } },
    { id: 'satin', label: 'Satin', path: 'cloth/satin', route: '/drift/cloth/satin', family: 'cloth',
      defaults: { style: 'folds', palette: 'gold', freq: 1.2, fold: 0.5, drape: 0.4, sway: 0.4, evolve: 0.16, direction: 65, light: 55, sheen: 1.2, contrast: 1.25, grain: 0.015, period: 10 } },
    { id: 'linen', label: 'Linen', path: 'cloth/linen', route: '/drift/cloth/linen', family: 'cloth',
      defaults: { style: 'folds', palette: 'linen', freq: 1.4, fold: 0.4, drape: 0.3, sway: 0.2, evolve: 0.12, direction: 80, light: 50, sheen: 0.4, contrast: 1.0, grain: 0.04, period: 14 } },
  ],
}

// Page › Category › Preset: the 3 families are CATEGORIES (sidebar), their SUBPAGES
// are the PRESETS picked in the rail's Preset dropdown.
export const presetsForCat = (id) => SUBPAGES[id] || SUBPAGES.air
