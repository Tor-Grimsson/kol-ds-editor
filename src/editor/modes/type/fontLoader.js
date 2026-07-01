/**
 * Font loader for the morph engine.
 *
 * Fetches a Right Grotesk ttf from /public/fonts/Right-Grotesk-ttf/ (pre-
 * generated from the woff2 sources via `node scripts/woff2-to-ttf.js`) and
 * parses with opentype.js. Returns the parsed Font object, which exposes
 * getPath(char, x, y, fontSize) for outline extraction.
 *
 * Why pre-generate ttf instead of decompressing woff2 at runtime: the
 * `wawoff2` decompressor uses Node fs + emscripten internals and doesn't
 * bundle cleanly for the browser via Vite. Pre-converting is one-shot and
 * leaves the runtime path simple.
 *
 * Promises are cached by `${width}-${weight}-${italic}` so repeated calls
 * for the same cut return the same Font without re-fetching.
 */

import opentype from 'opentype.js'

const cache = new Map()

const WEIGHT_NAME = {
  100: 'Fine',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Dark',
  700: 'Bold',
  900: 'Black',
}

/* `width` is a cuts.js width id ('base', 'Compact', 'Tall', 'Wide', 'Narrow',
 * 'Spatial', 'Tight'). 'base' has no width prefix in the filename. */
function fontPath(width, weight, italic = false) {
  const widthPart  = width === 'base' || !width ? '' : width
  const weightPart = WEIGHT_NAME[weight] ?? 'Regular'
  const italicPart = italic ? 'Italic' : ''
  return `/fonts/Right-Grotesk-ttf/PPRightGrotesk-${widthPart}${weightPart}${italicPart}.ttf`
}

export async function loadFont(width, weight, italic = false) {
  const key = `${width}-${weight}-${italic ? '1' : '0'}`
  if (cache.has(key)) return cache.get(key)

  const promise = (async () => {
    const url    = fontPath(width, weight, italic)
    const buffer = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Font fetch failed: ${url}`)
      return r.arrayBuffer()
    })
    return opentype.parse(buffer)
  })()

  cache.set(key, promise)
  promise.catch(() => cache.delete(key))
  return promise
}
