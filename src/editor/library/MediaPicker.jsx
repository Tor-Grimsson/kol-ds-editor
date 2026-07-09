import { useEffect, useRef, useState } from 'react'
import { Input } from '@kolkrabbi/kol-component'
import EditorButton from '../components/EditorButton'
import { listMedia, mediaUrl, isImageType, isVideoType, formatSize } from './mediaLibrary'

/**
 * MediaPicker — modal browser over the kol-media CDN bucket (the labs
 * LibraryPage model). Folder drill-down + breadcrumb over the flat key list,
 * a lightbox preview (image / video, ←/→ step, Esc close, name + size), a
 * click-to-copy public URL, and the "Use" pick.
 *
 * Pick contract (unchanged — called from EditorFooter + LayerInspector):
 * onPick(url, { contentType }); the caller rewrites the URL through
 * `proxied()` before storing it on a layer. `accept`: 'image' | 'video' |
 * 'all' filters which files are pickable/shown.
 *
 * The whole bucket is listed once on open (listMedia('')) and the folder tree
 * is derived client-side from key path segments — `prefix` is the current
 * folder, the text input is a secondary name filter WITHIN it.
 */

/* Split a scoped object list into immediate sub-folders (first path segment
 * below `prefix`) + files that live directly in `prefix`. displayKey is the
 * name relative to the current folder. */
function partition(objects, prefix) {
  const folderSet = new Set()
  const files = []
  for (const o of objects) {
    const rel = prefix ? o.key.slice(prefix.length) : o.key
    const slash = rel.indexOf('/')
    if (slash !== -1) folderSet.add(rel.slice(0, slash + 1))
    else files.push({ ...o, displayKey: rel })
  }
  return { folders: [...folderSet].sort(), files }
}

/* Inline directional chevron — the editor icon registry has no left/right
 * chevron, and a rotated one reads oddly at button sizes. */
function Chevron({ dir = 'left', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ transform: dir === 'right' ? 'scaleX(-1)' : undefined }}>
      <path d="M14.5 6L8.5 12L14.5 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* Lightbox preview over `files` at `index`. Owns its own ←/→/Esc keys; the
 * picker suppresses its own Esc while this is open so one keypress steps back
 * one level, not straight out. */
function MediaLightbox({ files, index, onClose, onPrev, onNext, onUse, accept }) {
  const videoRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const o = files[index]

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, onPrev, onNext])

  useEffect(() => { setCopied(false); videoRef.current?.load() }, [index])

  if (!o) return null

  const pickable =
    accept === 'video' ? isVideoType(o.contentType)
    : accept === 'image' ? isImageType(o.contentType)
    : isImageType(o.contentType) || isVideoType(o.contentType)

  const copyUrl = async () => {
    try { await navigator.clipboard.writeText(mediaUrl(o.key)) } catch { /* blocked */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center"
      style={{ background: 'rgba(0, 0, 0, 0.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded text-meta hover:text-emphasis transition-colors"
        onClick={(e) => { e.stopPropagation(); onPrev() }}
        aria-label="Previous"
      >
        <Chevron dir="left" />
      </button>

      <div className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {isImageType(o.contentType) ? (
          <img
            src={mediaUrl(o.key)}
            alt={o.displayKey}
            className="max-w-full max-h-[70vh] object-contain rounded"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
          />
        ) : isVideoType(o.contentType) ? (
          <video
            ref={videoRef}
            src={mediaUrl(o.key)}
            controls
            autoPlay
            loop
            muted
            className="max-w-full max-h-[70vh] rounded"
            style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}
          />
        ) : (
          <div className="w-40 h-40 flex flex-col items-center justify-center gap-2 text-meta">
            <span className="kol-mono-12">{o.contentType || 'file'}</span>
          </div>
        )}
        <div className="flex items-center gap-4">
          <span className="kol-mono-12 text-emphasis">{o.displayKey}</span>
          <span className="kol-mono-12 text-meta">{formatSize(o.size)}</span>
        </div>
        <span className="kol-mono-10 text-meta">{index + 1} / {files.length}</span>
        <div className="flex items-center gap-2 mt-1">
          {pickable && (
            <EditorButton variant="primary" size="sm" onClick={() => onUse(o)}>
              Use
            </EditorButton>
          )}
          <EditorButton variant="secondary" size="sm" onClick={copyUrl}>
            {copied ? 'Copied' : 'Copy URL'}
          </EditorButton>
        </div>
      </div>

      <button
        type="button"
        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded text-meta hover:text-emphasis transition-colors"
        onClick={(e) => { e.stopPropagation(); onNext() }}
        aria-label="Next"
      >
        <Chevron dir="right" />
      </button>

      <EditorButton
        variant="primary" size="sm" quiet
        iconOnly="close" iconSize={14}
        aria-label="Close preview"
        className="absolute top-4 right-4"
        onClick={onClose}
      />
    </div>
  )
}

export default function MediaPicker({ open, onClose, onPick, accept = 'all' }) {
  const [prefix, setPrefix] = useState('')       /* current folder (ends '/'), '' = root */
  const [filter, setFilter] = useState('')        /* secondary name filter within the folder */
  const [allObjects, setAllObjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  /* List the whole bucket once per open; drill-down is client-side. */
  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setLoading(true)
    setError(null)
    setPrefix('')
    setFilter('')
    setLightboxIndex(null)
    listMedia('')
      .then((objs) => { if (!cancelled) setAllObjects(objs) })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open])

  /* Esc closes the picker — but only when the lightbox isn't up (it owns Esc
   * to step back one level first). */
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape' && lightboxIndex === null) onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, lightboxIndex])

  if (!open) return null

  const wanted = (o) =>
    accept === 'video' ? isVideoType(o.contentType)
    : accept === 'image' ? isImageType(o.contentType)
    : isImageType(o.contentType) || isVideoType(o.contentType)

  const scoped = prefix ? allObjects.filter((o) => o.key.startsWith(prefix)) : allObjects
  const { folders, files } = partition(scoped, prefix)
  const q = filter.trim().toLowerCase()
  const visibleFolders = q ? folders.filter((f) => f.toLowerCase().includes(q)) : folders
  const visibleFiles = (q ? files.filter((o) => o.displayKey.toLowerCase().includes(q)) : files).filter(wanted)
  const crumbs = prefix ? prefix.replace(/\/$/, '').split('/') : []

  const pick = (o) => { onPick?.(mediaUrl(o.key), { contentType: o.contentType }); onClose?.() }

  return (
    <>
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
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name"
              className="flex-1"
            />
            <EditorButton
              variant="primary" size="sm" quiet
              iconOnly="close" iconSize={14}
              aria-label="Close"
              onClick={onClose}
            />
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 px-5 h-9 border-b border-fg-08 shrink-0 kol-mono-12 text-meta overflow-x-auto">
            <button type="button" className="hover:text-emphasis transition-colors whitespace-nowrap" onClick={() => setPrefix('')}>root</button>
            {crumbs.map((seg, i) => {
              const to = crumbs.slice(0, i + 1).join('/') + '/'
              return (
                <span key={to} className="flex items-center gap-1 whitespace-nowrap">
                  <span>/</span>
                  <button type="button" className="hover:text-emphasis transition-colors" onClick={() => setPrefix(to)}>{seg}</button>
                </span>
              )
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5" style={{ scrollbarWidth: 'thin' }}>
            {error ? (
              <p className="kol-helper-12 text-ui-error">Couldn’t load: {error}</p>
            ) : loading ? (
              <p className="kol-helper-12 text-meta">Loading…</p>
            ) : (
              <>
                {visibleFolders.length > 0 && (
                  <ul className="flex flex-col mb-4 list-none m-0 p-0">
                    {visibleFolders.map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-3 py-2 px-1 border-b border-fg-08 cursor-pointer hover:bg-fg-04 transition-colors rounded"
                        onClick={() => { setPrefix(prefix + f); setFilter('') }}
                      >
                        <span className="kol-mono-12 text-emphasis flex-1">{f}</span>
                        <Chevron dir="right" size={14} />
                      </li>
                    ))}
                  </ul>
                )}

                {visibleFiles.length === 0 ? (
                  <p className="kol-helper-12 text-meta">Nothing here{filter ? ` for “${filter}”` : ''}.</p>
                ) : (
                  <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] list-none m-0 p-0">
                    {visibleFiles.map((o, idx) => (
                      <li
                        key={o.key}
                        className="cursor-pointer"
                        title={o.key}
                        onClick={() => setLightboxIndex(idx)}
                      >
                        <div className="aspect-square bg-fg-04 rounded overflow-hidden border border-fg-08 hover:border-fg-24 transition-colors">
                          {isVideoType(o.contentType) ? (
                            <video src={mediaUrl(o.key)} muted preload="metadata" className="w-full h-full object-cover" />
                          ) : (
                            <img src={mediaUrl(o.key)} alt="" loading="lazy" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <p className="kol-helper-10 text-meta truncate mt-1">{o.displayKey}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {lightboxIndex !== null && visibleFiles[lightboxIndex] && (
        <MediaLightbox
          files={visibleFiles}
          index={lightboxIndex}
          accept={accept}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => (i - 1 + visibleFiles.length) % visibleFiles.length)}
          onNext={() => setLightboxIndex((i) => (i + 1) % visibleFiles.length)}
          onUse={pick}
        />
      )}
    </>
  )
}
