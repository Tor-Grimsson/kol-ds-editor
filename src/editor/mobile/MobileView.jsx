import { useEffect, useRef, useState } from 'react'
import { EditorProviders } from '../Editor'
import EditorButton from '../components/EditorButton'
import { OutputStage } from '../OutputView'
import { useComposeState, CANVAS_W } from '../compose/state'
import { PRESET_SIZES } from '../shell/aspects'
import { transport } from '../params/transport'
import { applyThemeMode, getThemeMode } from '../theme'
import { GENERATIVE_TREE } from '../../loops/taxonomy'
import { presetsInGroup, presetParams } from '../../loops/registry'
import { saveClip } from '../lib/clipStore'
import { isTabletSized, goDesktop } from './device'
import MobileOverlay from './MobileOverlay'

/**
 * MobileView — the generative chrome touch devices get instead of the editor
 * (App gates on primary-pointer coarse; `./device`). Not a shrunk editor: a
 * randomize-only playground over the same engine. Flow: entry (Insert media /
 * Generate, tablets get a "Use desktop editor" opt-in) → category (the
 * GENERATIVE_TREE types as buttons) → live (full-display 4:5 stage +
 * `MobileOverlay`'s scoped-randomize / download / hide-UI controls).
 *
 * The session is EPHEMERAL by construction: EditorProviders seed the default
 * doc (aspect already 4:5), nothing autosaves (the draft flow lives in the
 * desktop Compose shell, never mounted here), so the desktop draft can't be
 * clobbered. Reload = fresh start.
 */

function EntryScreen({ onInsert, onGenerate }) {
  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm p-6">
      <div className="w-full max-w-sm">
        <EditorButton variant="primary" size="lg" className="w-full" onClick={onInsert}>Insert image or video</EditorButton>
      </div>
      <div className="w-full max-w-sm">
        <EditorButton variant="primary" size="lg" className="w-full" onClick={onGenerate}>Generate</EditorButton>
      </div>
      {isTabletSized() && (
        <div className="mt-8">
          <EditorButton variant="ghost" size="lg" onClick={goDesktop}>
            Use desktop editor
          </EditorButton>
        </div>
      )}
    </div>
  )
}

function CategoryScreen({ onPick, onBack }) {
  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center overflow-y-auto bg-black/60 p-6 backdrop-blur-sm">
      <div className="my-auto flex w-full flex-col items-center gap-2 py-6">
        <div className="kol-helper-12 text-meta mb-2">Pick a generator</div>
        {GENERATIVE_TREE.map((entry) => (
          <div key={entry.label} className="w-full max-w-sm">
            <EditorButton variant="primary" size="lg" className="w-full" onClick={() => onPick(entry)}>
              {entry.label}
            </EditorButton>
          </div>
        ))}
        <div className="mt-4">
          <EditorButton variant="ghost" size="lg" onClick={onBack}>Back</EditorButton>
        </div>
      </div>
    </div>
  )
}

/* The full-preset patch for a taxonomy entry's first group — LoopPicker's
 * applyPreset shape (a preset is a full param reset, not a diff). */
function firstPresetPatch(entry) {
  const group = entry.groups[0]
  const preset = presetsInGroup(group)[0]
  if (!preset) return null
  return {
    loopGroup:   group,
    presetId:    preset.id,
    presetLabel: preset.label,
    loopId:      preset.loop,
    ...presetParams(preset),
  }
}

function MobileBody() {
  const { layers, addLayer, removeLayer, updateLayer, canvasW, canvasH, aspect, setAspect } = useComposeState()
  const [screen, setScreen] = useState('entry')   /* entry | category | live */
  const [activeId, setActiveId] = useState(null)
  const [stageFit, setStageFit] = useState('contain')  /* contain = 4:5 letterbox · cover = fill display */
  const fileRef = useRef(null)

  useEffect(() => {
    applyThemeMode(getThemeMode())
    /* The provider inits aspect '4:5' but canvasW/H 1080×1080 — desktop
     * reconciles that in EditorBody's boot; mobile must do the same or every
     * full-frame layer is built square inside a 4:5 frame. */
    setAspect('4:5')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = layers.find((l) => l.id === activeId) ?? null

  const startGenerative = (entry) => {
    const patch = firstPresetPatch(entry)
    if (!patch) return
    const id = addLayer('loop', patch)
    setActiveId(id)
    transport.play()
    setScreen('live')
  }

  /* Live category hop — same patch onto the existing loop layer (LoopPicker
   * type-hop semantics; lingering old-group keys are the accepted model). */
  const switchCategory = (entry) => {
    const patch = firstPresetPatch(entry)
    if (patch && activeId) updateLayer(activeId, patch)
  }

  const insertFile = (file) => {
    const isVideo = file.type.startsWith('video/')
    if (!isVideo && !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    /* Full-bleed cover — on mobile the media IS the composition (desktop's
     * drop-at-point 60%-fit placement doesn't apply). */
    const virtualH = Math.round(CANVAS_W * canvasH / canvasW)
    const id = addLayer('photo', {
      src: url, srcType: isVideo ? 'video' : 'image', fit: 'cover',
      x: 0, y: 0, w: CANVAS_W, h: virtualH,
    })
    if (isVideo && id) saveClip(id, file)
    setActiveId(id)
    transport.play()
    setScreen('live')
  }

  /* Output-tab aspect control: a real aspect id re-frames the composition
   * (setAspect) AND refits the active full-frame layer to the new frame —
   * mobile's invariant is "the layer IS the composition". 'fill' is
   * display-only cover; the aspect keeps whatever it was. */
  const setStageAspect = (id) => {
    if (id === 'fill') { setStageFit('cover'); return }
    setStageFit('contain')
    setAspect(id)
    const sz = PRESET_SIZES[id]
    if (activeId && sz) {
      updateLayer(activeId, { x: 0, y: 0, w: CANVAS_W, h: Math.round(CANVAS_W * sz.h / sz.w) })
    }
  }

  const restart = () => {
    /* removeLayer per layer (not clearLayers) so a video layer's IndexedDB
     * clip is freed here — mobile never runs the desktop's load-time gc. */
    for (const l of [...layers]) removeLayer(l.id)
    setActiveId(null)
    setScreen('entry')
  }

  return (
    <div className="fixed inset-0 bg-black">
      <OutputStage fit={stageFit} />
      {screen === 'entry' && (
        <EntryScreen onInsert={() => fileRef.current?.click()} onGenerate={() => setScreen('category')} />
      )}
      {screen === 'category' && (
        <CategoryScreen onPick={startGenerative} onBack={() => setScreen('entry')} />
      )}
      {screen === 'live' && (
        <MobileOverlay
          layer={active}
          onSwitchCategory={switchCategory}
          onRestart={restart}
          aspectValue={stageFit === 'cover' ? 'fill' : aspect}
          onAspect={setStageAspect}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) insertFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default function MobileView() {
  return (
    <EditorProviders persistDraft={false}>
      <MobileBody />
    </EditorProviders>
  )
}
