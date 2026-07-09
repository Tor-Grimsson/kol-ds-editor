// Pixi tier — the GPU batch that runs AFTER the synchronous canvas chain and
// BEFORE any terminal GL engine. Ported from labs
// (kol-labs-single/src/pages/effects/engine/pixiPipeline.js), with the `stack`
// shape adapted to the editor's resolved chain stages ({ id, params }).
//
// ONE persistent Pixi Application (init'd lazily, reused across renders — a
// create-app-per-render pattern leaks GL contexts). Each render makes throwaway
// textures/sprites and destroys them; the app + GL context persist. Reached
// ONLY via dynamic import() from LayerRenderer, so pixi.js/pixi-filters
// code-split into their own chunk.
//
// Filters chain natively via `sprite.filters = [...]`. After awaiting the
// (one-time) app init, the body runs synchronously to completion — JS is
// single-threaded and there's no further await — so concurrent layer calls
// never interleave on the shared app.stage.

import { Application, Sprite, Texture, CanvasSource, Rectangle } from 'pixi.js'
import { createPixiFilter } from './adapter.js'

let appPromise = null
function getApp() {
  if (!appPromise) {
    const app = new Application()
    appPromise = app
      .init({ width: 16, height: 16, backgroundAlpha: 0, antialias: true, preference: 'webgl', autoStart: false })
      .then(() => app)
      .catch((e) => { appPromise = null; throw e }) // let a failed init retry next time
  }
  return appPromise
}

// Synchronous canvas → texture (avoids an async Assets.load(dataURL)).
function textureFromCanvas(canvas) {
  return new Texture({ source: new CanvasSource({ resource: canvas }) })
}

// Grayscale multi-octave noise map for the displacement filter (ported verbatim).
function makeNoiseCanvas(w, h, params) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, h)
  const frequency = params.frequency || 1
  const octaves = params.octaves || 3
  const persistence = params.persistence || 0.5
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let value = 0
      let amplitude = 1
      let freq = frequency / 100
      for (let o = 0; o < octaves; o++) {
        const n = (Math.sin(x * freq * 12.9898 + y * freq * 78.233) * 43758.5453) % 1
        value += n * amplitude
        amplitude *= persistence
        freq *= 2
      }
      const v = ((value / octaves) * 255) | 0
      const i = (y * w + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/**
 * Apply the pixi stages to `sourceCanvas`. `stack` = the layer's ENABLED pixi
 * stages ([{ id, params }] in chain order — the caller pre-filters via
 * pixiStages()). Returns a Promise<canvas> of the filtered result at the
 * source's own dims, or null if the stack is empty.
 */
export async function applyPixiStack(sourceCanvas, stack) {
  const enabled = Array.isArray(stack) ? stack : []
  if (enabled.length === 0) return null

  const app = await getApp()
  const w = sourceCanvas.width
  const h = sourceCanvas.height
  app.renderer.resize(w, h)
  app.stage.removeChildren()

  const trash = []
  const filters = []
  for (const fx of enabled) {
    const params = fx.params || {}
    if (fx.id === 'filter-displacement') {
      // The map sprite must be in the scene graph; add it BEHIND the main
      // sprite so the (full-size, opaque) main sprite covers it on extract.
      const noiseTex = textureFromCanvas(makeNoiseCanvas(w, h, params))
      const noiseSprite = new Sprite(noiseTex)
      app.stage.addChild(noiseSprite)
      trash.push(noiseSprite, noiseTex)
      const f = createPixiFilter(fx.id, params, noiseSprite, { w, h })
      if (f) filters.push(f)
    } else {
      const f = createPixiFilter(fx.id, params, null, { w, h })
      if (f) filters.push(f)
    }
  }

  const baseTex = textureFromCanvas(sourceCanvas)
  const sprite = new Sprite(baseTex)
  sprite.filters = filters
  app.stage.addChild(sprite)
  trash.push(sprite, baseTex)

  // Fixed frame so bounds-expanding filters (glow/shadow/bloom) extract at
  // exactly w×h, origin-aligned (effects past the edge are clipped, as with a
  // fixed-size canvas) — not the grown container bounds.
  const out = app.renderer.extract.canvas({ target: app.stage, frame: new Rectangle(0, 0, w, h) })

  // Teardown — extract is synchronous, so the GPU work is done by here.
  app.stage.removeChildren()
  for (const f of filters) { try { f.destroy?.() } catch { /* noop */ } }
  for (const t of trash) { try { t.destroy?.() } catch { /* noop */ } }

  return out
}
