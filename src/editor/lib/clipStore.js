/**
 * clipStore — reload-survival for uploaded video clips.
 *
 * A locally-uploaded video enters the canvas as an objectURL (blob:…), which
 * is void after a reload — the draft autosave (compose/state.jsx) persists the
 * layer (id + now-dead src) to localStorage, but the blob itself is gone. This
 * side-channel stores the clip Blob in IndexedDB keyed by the video layer's id
 * (the same id the draft already persists), so draft hydrate can mint a fresh
 * objectURL for it.
 *
 * Raw IndexedDB, promise-wrapped, framework-free. Every call degrades silently
 * when storage is unavailable (private mode, quota) — the clip just won't
 * survive reload, exactly like today.
 *
 * Only locally-uploaded blobs go here (the EditorFooter "Upload video" path).
 * Library / CDN videos carry a same-origin proxy URL that already survives
 * reload, so they are never stored and never restored.
 */
const DB = 'kol-editor-clips'
const STORE = 'clips'

const open = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })

/* Persist a clip Blob under a video layer's id (overwrites on re-upload). */
export async function saveClip(id, blob) {
  try {
    const db = await open()
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(blob, id)
      tx.oncomplete = res
      tx.onerror = () => rej(tx.error)
    })
  } catch { /* persistence unavailable */ }
}

/* The stored Blob for a layer id, or null. */
export async function loadClip(id) {
  try {
    const db = await open()
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly')
      const rq = tx.objectStore(STORE).get(id)
      rq.onsuccess = () => res(rq.result || null)
      rq.onerror = () => rej(rq.error)
    })
  } catch { return null }
}

/* Drop a stored clip (call when a video layer is deleted / its src cleared). */
export async function deleteClip(id) {
  try {
    const db = await open()
    await new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = res
    })
  } catch { /* */ }
}

/* Reclaim orphans — delete every stored clip whose id isn't owned by a (blob:)
 * video layer in `layers`. Run on load keyed to the restored canvas, so clips
 * left behind by delete / File→New / Clear / a crash don't accumulate forever.
 * Silent + no-op when storage is unavailable or nothing is orphaned. */
export async function gcClips(layers) {
  try {
    /* Skip if the clips DB was never created — no clip was ever saved, so
     * there's nothing to reclaim, and gcClips must not be the thing that
     * creates it (that left an empty DB on every load for never-video users).
     * `indexedDB.databases()` is unsupported on older Firefox — there we fall
     * through and open() as before (the empty-DB churn only affects those). */
    if (typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases()
      if (!dbs.some((d) => d.name === DB)) return
    }
    const keep = new Set(deadClipIds(layers))
    const db = await open()
    const all = await new Promise((res, rej) => {
      const rq = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys()
      rq.onsuccess = () => res(rq.result || [])
      rq.onerror = () => rej(rq.error)
    })
    const orphans = all.filter((id) => !keep.has(id))
    if (orphans.length === 0) return
    await new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      orphans.forEach((id) => store.delete(id))
      tx.oncomplete = res
    })
  } catch { /* storage unavailable — nothing to reclaim */ }
}

/* Deep-collect ids of video layers whose src is a DEAD objectURL (blob:…) —
 * the only ones that need restoring; library/CDN (http) videos are skipped so
 * a stale clip under a reused id can never override a live source. */
function deadClipIds(layers, out = []) {
  for (const l of layers) {
    if (l?.srcType === 'video' && l?.id && typeof l.src === 'string' && l.src.startsWith('blob:')) out.push(l.id)
    if (Array.isArray(l?.children)) deadClipIds(l.children, out)
  }
  return out
}

/* Deep-swap src for the id→url map — new tree, untouched subtrees keep
 * identity (same blob: guard as the collect pass). */
function swapClipSrc(layers, urls) {
  let changed = false
  const next = layers.map((l) => {
    let nl = l
    if (l?.srcType === 'video' && urls[l.id] && typeof l.src === 'string' && l.src.startsWith('blob:')) {
      nl = { ...l, src: urls[l.id] }
      changed = true
    }
    if (Array.isArray(l?.children)) {
      const kids = swapClipSrc(l.children, urls)
      if (kids !== l.children) { nl = { ...nl, children: kids }; changed = true }
    }
    return nl
  })
  return changed ? next : layers
}

/**
 * hydrateVideoClips — for a restored layer tree, mint fresh objectURLs for any
 * video layer whose clip was persisted (by layer id). Layers without a stored
 * clip (library/CDN videos, or clips lost to a cleared store) keep their src.
 * Returns a (possibly new) layer tree; safe to await in the draft-restore flow.
 */
export async function hydrateVideoClips(layers) {
  const ids = deadClipIds(layers)
  if (ids.length === 0) return layers
  const urls = {}
  await Promise.all(ids.map(async (id) => {
    const blob = await loadClip(id)
    if (blob) urls[id] = URL.createObjectURL(blob)
  }))
  return Object.keys(urls).length ? swapClipSrc(layers, urls) : layers
}
