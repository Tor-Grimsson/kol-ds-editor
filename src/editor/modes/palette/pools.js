/**
 * Color pools for the Combo Lab palette engine.
 *
 * Each pool has:
 *   colors    — list of hex values eligible for sampling.
 *   defaults  — canonical 6-color arrangement (5 layout slots + 1 background).
 *
 * Both are LIVE — resolved from CSS custom properties at access time via the
 * `colors` / `defaults` getters. Single source of truth:
 * @kolkrabbi/kol-framework/kol-brand-color.css (imported by src/index.css).
 * Edit a token there and the lab regenerates with the new value on next render.
 *
 * Architecture: docs/kol-migration/locked/color-system.md
 */

import { resolveCssVar } from '../../../components/sections/ColorRamp'

/* Token paths per ramp — single place to edit if a ramp grows / shrinks.
 * Hue + cream ramps are the DS palette primitives (`--kol-color-{hue}-N`);
 * grey is the fixed project neutral (`--grey-N`). These must match the
 * declared names in kol-brand-color.css exactly — an unknown var makes the
 * resolver probe fall back to the inherited body color, collapsing every
 * swatch to the same hex. */
const RAMP = {
  yellow: [100, 200, 300, 400, 500].map(n => `--kol-color-yellow-${n}`),
  red:    [100, 200, 300, 400, 500].map(n => `--kol-color-red-${n}`),
  blue:   [100, 200, 300, 400, 500].map(n => `--kol-color-blue-${n}`),
  orange: [100, 200, 300, 400, 500].map(n => `--kol-color-orange-${n}`),
  teal:   [100, 200, 300, 400, 500].map(n => `--kol-color-teal-${n}`),
  cream:  [100, 200, 300, 400, 500].map(n => `--kol-color-cream-${n}`),
  grey:   [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(n => `--grey-${n}`),
}

/** Resolve an array of token names to live hex values. */
const resolve = (tokens) => tokens.map(t => resolveCssVar(t))

/** Build a pool with live `colors` + `defaults` getters. */
function pool(id, label, colorTokens, defaultTokens, extras = {}) {
  return {
    id,
    label,
    get colors()   { return resolve(colorTokens) },
    get defaults() { return resolve(defaultTokens) },
    ...extras,
  }
}

export const POOLS = [
  /* Seed mode — palette is generated from a user-supplied base color. No pool
   * sampling, no live resolution needed. */
  {
    id: 'seed',
    label: 'Seed color',
    colors: [],
    defaults: ['#CCCCCC', null, null, null, null, null],
    isSeed: true,
  },

  /* Brand — canonical Kolkrabbi composition: yellow primary, red secondary,
   * navy ink, cream surface, orange accent. */
  pool(
    'brand',
    'Brand',
    [...RAMP.yellow, ...RAMP.red],
    ['--kol-color-yellow-300', '--kol-color-red-200', '--kol-color-cream-100', '--kol-color-blue-400', '--kol-color-orange-300', '--kol-color-cream-300'],
  ),

  /* All · light — every brand ramp + cream + grey. Cream-leaning bg. */
  pool(
    'all-light',
    'All · light',
    [...RAMP.yellow, ...RAMP.red, ...RAMP.blue, ...RAMP.orange, ...RAMP.teal, ...RAMP.cream, ...RAMP.grey],
    ['--kol-color-yellow-300', '--kol-color-red-200', '--kol-color-cream-100', '--kol-color-blue-400', '--kol-color-orange-300', '--kol-color-cream-200'],
  ),

  /* All · dark — every brand ramp + cream + grey. Dark bg. */
  pool(
    'all-dark',
    'All · dark',
    [...RAMP.yellow, ...RAMP.red, ...RAMP.blue, ...RAMP.orange, ...RAMP.teal, ...RAMP.cream, ...RAMP.grey],
    ['--kol-color-yellow-300', '--kol-color-orange-300', '--grey-700', '--kol-color-blue-400', '--kol-color-red-200', '--kol-color-blue-500'],
  ),

  /* Single-hue studies — each brand ramp on its own. */
  pool('yellow', 'Yellow',  RAMP.yellow, [...RAMP.yellow, '--kol-color-yellow-100']),
  pool('red',    'Red',     RAMP.red,    [...RAMP.red,    '--kol-color-red-100']),
  pool('blue',   'Blue',    RAMP.blue,   [...RAMP.blue,   '--kol-color-blue-100']),
  pool('orange', 'Orange',  RAMP.orange, [...RAMP.orange, '--kol-color-orange-100']),
  pool('teal',   'Teal',    RAMP.teal,   [...RAMP.teal,   '--kol-color-teal-100']),

  /* Cream — utility neutral, no anchor. BG extends slightly darker. */
  pool(
    'cream',
    'Cream',
    RAMP.cream,
    [...RAMP.cream, '--kol-color-orange-100'],
  ),

  /* Greyscale — legacy 10-stop kept until opacity-hex revival. */
  pool(
    'greyscale',
    'Greyscale',
    RAMP.grey,
    ['--grey-50', '--grey-200', '--grey-400', '--grey-800', '--grey-900', '--grey-500'],
  ),
]

/* hex → token-name map, computed lazily on first access (after CSS is loaded). */
let _tokenMap = null
function buildTokenMap() {
  const map = {}
  for (const tokens of Object.values(RAMP)) {
    for (const t of tokens) {
      const hex = resolveCssVar(t).toUpperCase()
      /* Display name: drop the `--kol-color-` / `--` prefix so palette-panel
       * labels stay short (`yellow-300`, `cream-300`, `grey-500`). */
      const name = t.replace(/^--kol-color-/, '').replace(/^--/, '')
      if (hex) map[hex] = name
    }
  }
  return map
}

export const TOKEN_NAMES = new Proxy({}, {
  get(_, key) {
    if (!_tokenMap) _tokenMap = buildTokenMap()
    return _tokenMap[key]
  },
})

export const tokenNameFor = (hex) => {
  if (!_tokenMap) _tokenMap = buildTokenMap()
  return _tokenMap[(hex || '').toUpperCase()] ?? null
}

export const MODES = [
  { id: 'random',              label: 'Random'      },
  { id: 'monochromatic',       label: 'Mono'        },
  { id: 'analogous',           label: 'Analogous'   },
  { id: 'complementary',       label: 'Complement'  },
  { id: 'triadic',             label: 'Triadic'     },
  { id: 'doubleComplementary', label: 'Double comp' },
]
