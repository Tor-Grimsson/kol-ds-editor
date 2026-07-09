/**
 * Shared blob-download helper — the object-URL + anchor-click dance used by
 * every export path (compose SVG/PNG/webm, settings JSON, pattern + type SVG
 * downloads). One implementation so filename/mime behavior can't drift.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
