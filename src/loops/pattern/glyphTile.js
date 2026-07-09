// Glyph tile — a Right Grotesk letterform (or short run) as pattern-tile
// geometry. Restores the labs 'glyph' shape (kol-labs-single lib/glyphPath.js)
// on this repo's EXISTING font machinery: editor/modes/type/fontLoader.js
// (opentype.js over /public/fonts/Right-Grotesk-ttf, promise-cached per cut) —
// no second loader, no new dependency.
//
// Sync by contract, async by nature: `glyphShape` answers from the warm cache
// or returns null after kicking the load — the pattern loop draws nothing for
// that frame and retries next frame (labs' retry-next-frame idiom). Shapes come
// back in resolveShape's `{ viewBox, paths }` grammar so the tile engine treats
// a glyph exactly like any other tile.

import { loadFont } from '../../editor/modes/type/fontLoader.js'

const EM = 1000 // nominal units; the tile loop rescales to the cell anyway

const warm = new Map()    // cutKey → parsed opentype Font
const pending = new Set() // cutKey in flight (don't stack .then handlers per frame)
const failed = new Set()  // cutKey fetch/parse failed (don't refetch every frame)
const shapes = new Map()  // shapeKey → { viewBox, paths }

const cutKey = (width, weight) => `${width}-${weight}`

// → { viewBox:[x,y,w,h], paths:[d] } | null (font still cold / no text).
// `width` is a fontLoader cut id ('base','Compact','Tall','Wide','Narrow',
// 'Spatial','Tight'), `weight` one of its numeric weights (100…900).
export function glyphShape(width, weight, text) {
  if (!text) return null
  const ck = cutKey(width, weight)
  const font = warm.get(ck)
  if (!font) {
    if (!pending.has(ck) && !failed.has(ck)) {
      pending.add(ck)
      loadFont(width, weight, false)
        .then((f) => { warm.set(ck, f) })
        .catch(() => { failed.add(ck) })
        .finally(() => { pending.delete(ck) })
    }
    return null
  }
  const sk = `${ck}|${text}`
  if (shapes.has(sk)) return shapes.get(sk)
  // Full-run layout with kerning (opentype Font.getPath) → one path, tight box.
  const path = font.getPath(String(text), 0, 0, EM)
  const d = path.toPathData(2)
  const bb = path.getBoundingBox()
  const w = Math.max(1, bb.x2 - bb.x1)
  const h = Math.max(1, bb.y2 - bb.y1)
  const shape = { viewBox: [bb.x1, bb.y1, w, h], paths: d ? [d] : [] }
  shapes.set(sk, shape)
  return shape
}
