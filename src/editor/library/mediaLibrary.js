/**
 * mediaLibrary — read-only access to the kol-media CDN bucket (the labs
 * model, kol-labs-single src/lib/mediaLibrary.js). Public, no auth: list via
 * the admin API, fetch objects by their public URL.
 *
 *   const objs = await listMedia('photoshoot/')  // [{ key, contentType, size }]
 *   <img src={mediaUrl(obj.key)} />               // https://media.kolkrabbi.io/<key>
 *
 * Canvas consumers (photo filters getImageData the source) MUST load through
 * `proxied(url)` — the CDN sends NO CORS headers, so a cross-origin load
 * taints the canvas. The Vite dev/preview proxy rewrites /media/* to the CDN
 * same-origin (vite.config.js); static prod builds need an equivalent host
 * rewrite.
 */

const ADMIN_BASE = 'https://admin.kolkrabbi.io'
const PUBLIC_BASE = 'https://media.kolkrabbi.io'

/* Same-origin proxy path media is rewritten to (avoids CORS canvas taint).
 * Default `/media/` = the Vite dev/preview rewrite and the standalone app's
 * host rewrite. Library consumers set this via <DesignEditor mediaProxyBase>
 * to whatever path their host proxies to the CDN. */
let PROXY_BASE = '/media/'
export const setMediaProxyBase = (base) => { PROXY_BASE = base }

export const mediaUrl = (key) => `${PUBLIC_BASE}/${key}`
export const isImageType = (ct) => !!ct && ct.startsWith('image/')
export const isVideoType = (ct) => !!ct && ct.startsWith('video/')

/* Human-readable byte size (labs mediaLibrary parity) — used by the picker's
 * lightbox to show a file's weight. */
export function formatSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/* Rewrite a public CDN URL to the same-origin proxy path. Non-CDN
 * URLs (data:, blob:, already-proxied) pass through untouched. */
export const proxied = (url) => url.replace(/^https:\/\/media\.kolkrabbi\.io\//, PROXY_BASE)

/* List bucket objects, optionally under a folder prefix. Throws on a non-OK
 * response so callers can show an error. */
export async function listMedia(prefix = '', { signal } = {}) {
  const params = new URLSearchParams()
  if (prefix) params.set('prefix', prefix)
  const res = await fetch(`${ADMIN_BASE}/api/list?${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.objects || []
}
