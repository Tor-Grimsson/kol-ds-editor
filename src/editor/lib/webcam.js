/**
 * webcam — live-camera MediaStream registry for photo layers with
 * `srcType: 'webcam'`.
 *
 * A MediaStream is neither JSON-serializable nor history/draft-safe, so it
 * can't live on the layer. The layer only carries `srcType: 'webcam'` (and no
 * `src`); the actual stream is held here, keyed by the layer's id. LayerRenderer
 * reads it (ensureWebcam / getWebcamStream) to attach as a `<video>` srcObject,
 * and stops the tracks (stopWebcam) on layer delete / source change / unmount.
 *
 * `ensureWebcam` dedupes concurrent requests (the source button's user-gesture
 * request and LayerRenderer's mount effect race otherwise, double-prompting):
 * the in-flight promise is cached until it resolves. Framework-free, browser-
 * native getUserMedia — no deps, matching the editor's audio-input model.
 */
const streams = new Map()  /* layerId → MediaStream */
const pending = new Map()   /* layerId → Promise<MediaStream> (in-flight) */

/* The live stream for a layer id, or null. Synchronous — LayerRenderer's
 * plain path reads it once the mount effect's ensureWebcam has resolved. */
export function getWebcamStream(id) {
  const s = streams.get(id)
  return s && s.active ? s : null
}

/* Ensure a live camera stream exists for `id`, requesting one if needed.
 * Idempotent + race-safe: an active stream resolves immediately, an in-flight
 * request is shared. Rejects if the user denies the camera. */
export function ensureWebcam(id) {
  const existing = streams.get(id)
  if (existing && existing.active) return Promise.resolve(existing)
  const inFlight = pending.get(id)
  if (inFlight) return inFlight
  const p = navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then((stream) => { streams.set(id, stream); pending.delete(id); return stream })
    .catch((err) => { pending.delete(id); throw err })
  pending.set(id, p)
  return p
}

/* Stop + drop a layer's stream (camera light off). Called on layer delete,
 * source change away from webcam, and unmount. Safe on an unknown id. */
export function stopWebcam(id) {
  const s = streams.get(id)
  if (s) for (const t of s.getTracks()) t.stop()
  streams.delete(id)
  pending.delete(id)
}
