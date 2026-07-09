import { useEffect, useState } from 'react'
import EditorButton from '../../components/EditorButton'
import EditorIcon from '../../icons/EditorIcon'
import { ASPECTS, PRESET_SIZES } from '../aspects'

/**
 * BatchExportModal — the multi-size export matrix (poster-batch port).
 *
 * Pick a set of aspect presets × a set of @Nx scales; "Export all" renders
 * each combination as a PNG and bundles them into ONE store-only .zip
 * (useComposeFile.runBatchExport → zipStore). Overlay chrome mirrors
 * ShortcutsOverlay (fixed scrim, click-out / Esc to close, stop-propagation
 * on the card); the export loop + zip live in the hook, this is pure UI +
 * an N/M progress counter.
 */

/* Modal backdrop — dark in both themes (matches ShortcutsOverlay). */
const SCRIM = 'rgba(0, 0, 0, 0.6)'
const SCALES = [1, 2, 3]
/* 'custom' has no fixed dims — it's not a batch target. */
const PRESETS = ASPECTS.filter((a) => a.id !== 'custom')

export default function BatchExportModal({ open, onClose, runBatchExport, baseAspect, defaultScale = 1 }) {
  const [aspects, setAspects] = useState(() => new Set())
  const [scales, setScales]   = useState(() => new Set())
  const [progress, setProgress] = useState(null) /* { done, total } while running, else null */

  /* Seed the pick from the live frame each time the modal opens. */
  useEffect(() => {
    if (!open) return
    setAspects(new Set([PRESET_SIZES[baseAspect] ? baseAspect : '1:1']))
    setScales(new Set([[1, 2, 3].includes(defaultScale) ? defaultScale : 1]))
    setProgress(null)
  }, [open, baseAspect, defaultScale])

  const running = progress != null

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape' && !running) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, running, onClose])

  if (!open) return null

  const toggle = (setter) => (val) => setter((prev) => {
    const next = new Set(prev)
    next.has(val) ? next.delete(val) : next.add(val)
    return next
  })
  const toggleAspect = toggle(setAspects)
  const toggleScale  = toggle(setScales)

  const jobs = []
  for (const a of PRESETS) if (aspects.has(a.id)) for (const s of SCALES) if (scales.has(s)) jobs.push({ aspectId: a.id, scale: s })

  const close = () => { if (!running) onClose() }

  const onExport = async () => {
    if (!jobs.length || running) return
    setProgress({ done: 0, total: jobs.length })
    try {
      await runBatchExport(jobs, (done, total) => setProgress({ done, total }))
    } finally {
      setProgress(null)
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: SCRIM }}
      onClick={close}
    >
      <div
        className="bg-surface-primary border border-fg-08 rounded shadow-xl flex flex-col"
        style={{ width: 440, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 48px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-12 border-b border-fg-08">
          <span className="kol-helper-12 text-emphasis">Batch export</span>
          <EditorButton variant="primary" size="sm" quiet iconOnly="close" iconSize={14} aria-label="Close" onClick={close} />
        </div>

        <div className="overflow-y-auto p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="kol-helper-10 text-meta">Aspects</span>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((a) => (
                <CheckRow
                  key={a.id}
                  checked={aspects.has(a.id)}
                  disabled={running}
                  onToggle={() => toggleAspect(a.id)}
                  label={a.label}
                  meta={`${PRESET_SIZES[a.id].w}×${PRESET_SIZES[a.id].h}`}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="kol-helper-10 text-meta">Scale</span>
            <div className="grid grid-cols-3 gap-1.5">
              {SCALES.map((s) => (
                <CheckRow
                  key={s}
                  checked={scales.has(s)}
                  disabled={running}
                  onToggle={() => toggleScale(s)}
                  label={`@${s}x`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 h-14 border-t border-fg-08">
          <span className="kol-helper-10 text-meta whitespace-nowrap">
            {running
              ? `Exporting ${progress.done}/${progress.total}…`
              : `${jobs.length} file${jobs.length === 1 ? '' : 's'}`}
          </span>
          <EditorButton
            variant="primary"
            size="sm"
            iconLeft="download"
            iconSize={12}
            disabled={!jobs.length || running}
            onClick={onExport}
          >
            Export all
          </EditorButton>
        </div>
      </div>
    </div>
  )
}

/* A togglable pick cell — the box shows the editor's own `check` icon when
 * selected; the whole row is the hit target. */
function CheckRow({ checked, disabled, onToggle, label, meta }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`flex items-center gap-2 px-2 py-1.5 rounded border text-left ${checked ? 'border-fg-16 bg-fg-04' : 'border-fg-08'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-sm border ${checked ? 'border-fg-16' : 'border-fg-08'}`}>
        {checked && <EditorIcon name="check" size={12} />}
      </span>
      <span className="kol-helper-12 text-emphasis flex-1 whitespace-nowrap">{label}</span>
      {meta && <span className="kol-helper-10 text-meta">{meta}</span>}
    </button>
  )
}
