import { useEffect, useState } from 'react'
import { Input } from '@kolkrabbi/kol-component'
import EditorButton from '../components/EditorButton'
import { listMedia, mediaUrl, isImageType, isVideoType } from './mediaLibrary'

/**
 * MediaPicker — modal grid over the kol-media CDN bucket (the labs
 * MediaPicker, Library lane only — this editor has no local gallery).
 * Returns the pick via onPick(url, { contentType }); callers rewrite the
 * URL through `proxied()` before storing it on a layer.
 *
 * Overlay shell mirrors ShortcutsOverlay (fixed backdrop, Esc / backdrop
 * click / close button to dismiss). `accept`: 'image' | 'video' | 'all'
 * filters the grid.
 */
export default function MediaPicker({ open, onClose, onPick, accept = 'all' }) {
  const [prefix, setPrefix] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setLoading(true)
    setError(null)
    listMedia(prefix)
      .then((objs) => {
        if (cancelled) return
        setItems(objs.map((o) => ({
          url: mediaUrl(o.key),
          name: o.key.split('/').pop(),
          path: o.key,
          contentType: o.contentType,
        })))
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, prefix])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const wanted = (it) =>
    accept === 'video' ? isVideoType(it.contentType)
    : accept === 'image' ? isImageType(it.contentType)
    : isImageType(it.contentType) || isVideoType(it.contentType)
  const visible = items.filter(wanted)

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-surface-primary border border-fg-08 rounded shadow-xl flex flex-col"
        style={{ width: 720, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 48px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 h-12 border-b border-fg-08 shrink-0">
          <span className="kol-helper-12 text-emphasis whitespace-nowrap">Media library</span>
          <Input
            variant="filled"
            size="sm"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="Prefix — e.g. photoshoot/"
            className="flex-1"
          />
          <EditorButton
            variant="primary" size="sm" quiet
            iconOnly="close" iconSize={14}
            aria-label="Close"
            onClick={onClose}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5" style={{ scrollbarWidth: 'thin' }}>
          {error ? (
            <p className="kol-helper-12 text-ui-error">Couldn’t load: {error}</p>
          ) : loading ? (
            <p className="kol-helper-12 text-meta">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="kol-helper-12 text-meta">Nothing here{prefix ? ` for “${prefix}”` : ''}.</p>
          ) : (
            <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] list-none m-0 p-0">
              {visible.map((it) => (
                <li
                  key={it.url}
                  className="cursor-pointer"
                  title={it.path}
                  onClick={() => { onPick?.(it.url, { contentType: it.contentType }); onClose?.() }}
                >
                  <div className="aspect-square bg-fg-04 rounded overflow-hidden border border-fg-08 hover:border-fg-24 transition-colors">
                    {isVideoType(it.contentType) ? (
                      <video src={it.url} muted preload="metadata" className="w-full h-full object-cover" />
                    ) : (
                      <img src={it.url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <p className="kol-helper-10 text-meta truncate mt-1">{it.name}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
