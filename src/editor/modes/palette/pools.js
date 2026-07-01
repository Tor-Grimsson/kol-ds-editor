/**
 * Color pools for the Combo Lab palette engine.
 *
 * Each pool has:
 *   colors    — list of hex values eligible for sampling.
 *   defaults  — canonical 6-color arrangement (5 layout slots + 1 background).
 *
 * Both are LIVE — resolved from CSS custom properties at access time via the
 * `colors` / `defaults` getters. Single source of truth: src/styles/kol-color.css.
 * Edit a token there and the lab regenerates with the new value on next render.
 *
 * Architecture: docs/kol-migration/locked/color-system.md
 */

import { resolveCssVar } from '../../../components/sections/ColorRamp'

/* Token paths per ramp — single place to edit if a ramp grows / shrinks. */
const RAMP = {
  yellow: [100, 200, 300, 400, 500].map(n => `--brand-yellow-${n}`),
  red:    [100, 200, 300, 400, 500].map(n => `--brand-red-${n}`),
  blue:   [100, 200, 300, 400, 500].map(n => `--brand-blue-${n}`),
  orange: [100, 200, 300, 400, 500].map(n => `--brand-orange-${n}`),
  teal:   [100, 200, 300, 400, 500].map(n => `--brand-teal-${n}`),
  cream:  [100, 200, 300, 400, 500].map(n => `--cream-${n}`),
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
    ['--brand-yellow-300', '--brand-red-200', '--cream-100', '--brand-blue-400', '--brand-orange-300', '--cream-300'],
  ),

  /* All · light — every brand ramp + cream + grey. Cream-leaning bg. */
  pool(
    'all-light',
    'All · light',
    [...RAMP.yellow, ...RAMP.red, ...RAMP.blue, ...RAMP.orange, ...RAMP.teal, ...RAMP.cream, ...RAMP.grey],
    ['--brand-yellow-300', '--brand-red-200', '--cream-100', '--brand-blue-400', '--brand-orange-300', '--cream-200'],
  ),

  /* All · dark — every brand ramp + cream + grey. Dark bg. */
  pool(
    'all-dark',
    'All · dark',
    [...RAMP.yellow, ...RAMP.red, ...RAMP.blue, ...RAMP.orange, ...RAMP.teal, ...RAMP.cream, ...RAMP.grey],
    ['--brand-yellow-300', '--brand-orange-300', '--grey-700', '--brand-blue-400', '--brand-red-200', '--brand-blue-500'],
  ),

  /* Single-hue studies — each brand ramp on its own. */
  pool('yellow', 'Yellow',  RAMP.yellow, [...RAMP.yellow, '--brand-yellow-100']),
  pool('red',    'Red',     RAMP.red,    [...RAMP.red,    '--brand-red-100']),
  pool('blue',   'Blue',    RAMP.blue,   [...RAMP.blue,   '--brand-blue-100']),
  pool('orange', 'Orange',  RAMP.orange, [...RAMP.orange, '--brand-orange-100']),
  pool('teal',   'Teal',    RAMP.teal,   [...RAMP.teal,   '--brand-teal-100']),

  /* Cream — utility neutral, no anchor. BG extends slightly darker. */
  pool(
    'cream',
    'Cream',
    RAMP.cream,
    [...RAMP.cream, '--brand-orange-100'],
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
      const name = t.replace(/^--/, '')
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
