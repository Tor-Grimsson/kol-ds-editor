import { useState } from 'react'
import { SegmentedToggle } from '@kolkrabbi/kol-component'
import EditorButton from '../components/EditorButton'
import TransportBar from '../params/TransportBar'
import { useComposeState } from '../compose/state'
import { useComposeFile } from '../compose/useComposeFile'
import { groupById, loopById, presetsInGroup, presetParams } from '../../loops/registry'
import { GENERATIVE_TREE } from '../../loops/taxonomy'
import { deriveScopes, allScopeParams, computeRoll, useRollSeed } from '../params/rolls'

/**
 * MobileOverlay — one SEE-THROUGH floating modal (35% surface veil, no
 * borders anywhere), content split into SegmentedToggle tabs so only one
 * concern shows at a time:
 *
 *   Generate  — preset ⚄ / generator switch, then the inspector's roll block
 *   Transport — the established `TransportBar`, verbatim (▶ ❚❚ · Loop/N s · ■ ◀◀)
 *   Output    — download / hide UI / start over
 *
 * Header = title, tap collapses. Collapsed = the open pill + a bare
 * "Randomize all" beside it (roll without opening). "Hide UI" blanks
 * everything for screen-recording; tap anywhere brings it back.
 *
 * Rolls skip the desktop's motion/look dropdown-to-Custom bookkeeping — the
 * mobile doc is ephemeral and those dropdowns never render on it.
 */

const PANEL_STYLE = {
  background: 'color-mix(in srgb, var(--kol-surface-primary) 35%, transparent)',
  borderRadius: 'var(--kol-radius-sm)',
}

const TABS_LOOP  = [
  { value: 'generate',  label: 'Generate' },
  { value: 'transport', label: 'Transport' },
  { value: 'output',    label: 'Output' },
]
const TABS_MEDIA = TABS_LOOP.filter((t) => t.value !== 'generate')

/* All export-spec aspects (shell/aspects ids, portrait → landscape) + Fill
 * (display-side cover; the composition keeps its aspect). Two rows of 4 —
 * eight cells in one track don't fit a phone width. */
const ASPECT_ROW_1 = [
  { value: '9:16', label: '9:16' },
  { value: '3:5',  label: '3:5' },
  { value: '4:5',  label: '4:5' },
  { value: '1:1',  label: '1:1' },
]
const ASPECT_ROW_2 = [
  { value: '5:4',  label: '5:4' },
  { value: '5:3',  label: '5:3' },
  { value: '16:9', label: '16:9' },
  { value: 'fill', label: 'Fill' },
]

export default function MobileOverlay({ layer, onSwitchCategory, onRestart, aspectValue, onAspect }) {
  const { updateLayer } = useComposeState()
  const { onExportPng } = useComposeFile()
  const [uiHidden, setUiHidden] = useState(false)
  const [open, setOpen] = useState(true)
  const [showCats, setShowCats] = useState(false)
  const [tab, setTab] = useState('generate')
  const seed = useRollSeed(layer)

  if (!layer) return null

  /* Screen-record mode: everything gone, one invisible tap-catcher back. */
  if (uiHidden) {
    return <button aria-label="Show controls" className="fixed inset-0 z-20" onClick={() => setUiHidden(false)} />
  }

  const isLoop = layer.type === 'loop'
  const title = isLoop
    ? `${groupById(layer.loopGroup).label} · ${layer.presetLabel}`
    : 'Media'

  const schema = isLoop ? (loopById(layer.loopId)?.params ?? []) : []
  const scopes = isLoop ? deriveScopes(schema, layer) : []

  const rollAll = () =>
    updateLayer(layer.id, computeRoll(layer, allScopeParams(schema, layer), seed.take()))
  const rollScope = (scope) =>
    updateLayer(layer.id, computeRoll(layer, scope.params, seed.take(), { stripNoRandom: !!scope.motion }))
  const shufflePreset = () => {
    const pool = presetsInGroup(layer.loopGroup).filter((p) => p.id !== layer.presetId)
    const p = pool[Math.floor(Math.random() * pool.length)]
    if (p) updateLayer(layer.id, { presetId: p.id, presetLabel: p.label, loopId: p.loop, ...presetParams(p) })
  }

  /* Collapsed: Randomize all left, the open pill right. */
  if (!open) {
    return (
      <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {isLoop && (
          <EditorButton variant="primary" size="lg" onClick={rollAll}>Randomize all</EditorButton>
        )}
        <EditorButton variant="primary" size="lg" onClick={() => setOpen(true)}>{title} ▴</EditorButton>
      </div>
    )
  }

  const tabs = isLoop ? TABS_LOOP : TABS_MEDIA
  const activeTab = tabs.some((t) => t.value === tab) ? tab : tabs[0].value

  return (
    <>
      {/* Generator switch sheet */}
      {showCats && (
        <div className="fixed inset-0 z-20 flex flex-col items-center overflow-y-auto bg-black/60 p-6 backdrop-blur-sm">
          <div className="my-auto flex w-full flex-col items-center gap-2 py-6">
            {GENERATIVE_TREE.map((entry) => (
              <div key={entry.label} className="w-full max-w-sm">
                <EditorButton
                  variant="primary" size="lg"
                  className="w-full"
                  onClick={() => { onSwitchCategory(entry); setShowCats(false) }}
                >
                  {entry.label}
                </EditorButton>
              </div>
            ))}
            <EditorButton variant="ghost" size="lg" onClick={() => setShowCats(false)}>Cancel</EditorButton>
          </div>
        </div>
      )}

      {/* The one modal — see-through, borderless */}
      <div
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 backdrop-blur-sm"
        style={PANEL_STYLE}
      >
        {/* Header — one tap collapses */}
        <button
          className="kol-helper-12 text-meta flex w-full items-center justify-between px-3 py-2.5"
          onClick={() => setOpen(false)}
        >
          <span>{title}</span>
          <span>▾</span>
        </button>

        <div className="px-3 pb-3">
          <SegmentedToggle value={activeTab} onChange={setTab} options={tabs} size="lg" />

          {activeTab === 'generate' && isLoop && (
            <div className="flex flex-col gap-2 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <EditorButton variant="primary" size="lg" onClick={shufflePreset}>Preset ⚄</EditorButton>
                <EditorButton variant="primary" size="lg" onClick={() => setShowCats(true)}>Generator</EditorButton>
              </div>
              <EditorButton variant="primary" size="lg" className="w-full" onClick={rollAll}>
                Randomize all
              </EditorButton>
              {scopes.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {scopes.map((s) => (
                    <EditorButton key={s.id} variant="primary" size="lg" onClick={() => rollScope(s)}>
                      {s.label}
                    </EditorButton>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'transport' && (
            <div className="pt-3">
              <TransportBar size="lg" />
            </div>
          )}

          {activeTab === 'output' && (
            <div className="flex flex-col gap-2 pt-3">
              <SegmentedToggle value={aspectValue} onChange={onAspect} options={ASPECT_ROW_1} size="lg" ariaLabel="Aspect" />
              <SegmentedToggle value={aspectValue} onChange={onAspect} options={ASPECT_ROW_2} size="lg" ariaLabel="Aspect (landscape) and fill" />
              <div className="grid grid-cols-3 gap-2">
                <EditorButton variant="primary" size="lg" onClick={() => onExportPng(2)}>Download</EditorButton>
                <EditorButton variant="primary" size="lg" onClick={() => setUiHidden(true)}>Hide UI</EditorButton>
                <EditorButton variant="primary" size="lg" onClick={onRestart}>Start over</EditorButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
