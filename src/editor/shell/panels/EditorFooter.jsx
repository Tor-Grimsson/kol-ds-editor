import { useRef, useState } from 'react'
import { Dropdown, Section, SegmentedToggle } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import MediaPicker from '../../library/MediaPicker'
import { proxied, isVideoType } from '../../library/mediaLibrary'
import TransportBar from '../../params/TransportBar'
import AudioInputRow from '../../params/AudioInputRow'
import { useComposeFile } from '../../compose/useComposeFile'
import { useComposeState } from '../../compose/state'
import { useLayerEdit } from '../../compose/useLayerEdit'
import { findLayerDeep } from '../../compose/helpers'
import { ASPECTS } from '../aspects'

/**
 * EditorFooter — the tabbed rail footer, ported from the labs standard
 * (kol-labs-single `RailFooterTabs` + `EditorFooter`). Pinned below the
 * left rail's scroll body via the `left.footer` panel slot.
 *
 *   Transport · Output · File
 *     Transport — the playback TransportBar (stays mounted hidden so
 *                 playback chrome never re-inits on tab switch, per labs)
 *     Output    — Aspect preset + @Nx export scale + PNG / webm-loop export
 *     File      — context-sensitive: settings save/load + library save by
 *                 default; image upload/clear when a photo layer is selected
 */
const TABS = [
  { value: 'transport', label: 'Transport' },
  { value: 'output', label: 'Output' },
  { value: 'file', label: 'File' },
]

/* Tailwind v4 doesn't scan node_modules, so kol-component-only classes
 * (`h-[26px]`, `border-fg-04`) never get generated and the toggle collapses.
 * Naming them here puts them in app source → emitted → the component's own
 * identical classes resolve. Duplicates on the shell are harmless. */
const TOGGLE_FIX = 'h-[26px] border-fg-04'

/* File tab, photo-with-source mode — replace / clear the selected photo
 * layer's src (the ImageFields reader idiom; discrete history → undo-safe).
 * Sources: local image upload (data URL), local video upload (object URL),
 * or the kol-media CDN library via MediaPicker (proxied same-origin URL so
 * canvas filters don't taint). Every write sets srcType so image ↔ video
 * swaps render correctly. */
function PhotoFileTab({ layer }) {
  const { patch } = useLayerEdit(layer.id)
  const fileRef = useRef(null)
  const videoRef = useRef(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const onPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => patch({ src: reader.result, srcType: 'image' })
    reader.readAsDataURL(file)
  }
  const onPickVideo = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' /* allow re-picking the same file */
    if (!file) return
    patch({ src: URL.createObjectURL(file), srcType: 'video' })
  }
  const onLibraryPick = (url, { contentType } = {}) => {
    patch({ src: proxied(url), srcType: isVideoType(contentType) ? 'video' : 'image' })
  }
  const onClear = () => {
    patch({ src: null, srcType: 'image' })
    if (fileRef.current) fileRef.current.value = ''
  }
  return (
    <div className="flex flex-col gap-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={onPickVideo} />
      <EditorButton variant="primary" size="sm" className="w-full" iconLeft="upload" iconSize={12} onClick={() => fileRef.current?.click()}>
        Upload image
      </EditorButton>
      <EditorButton variant="primary" size="sm" className="w-full" iconLeft="upload" iconSize={12} onClick={() => videoRef.current?.click()}>
        Upload video
      </EditorButton>
      <EditorButton variant="primary" size="sm" className="w-full" iconLeft="image" iconSize={12} onClick={() => setPickerOpen(true)}>
        From library
      </EditorButton>
      {layer.src && (
        <EditorButton variant="secondary" size="sm" className="w-full" iconLeft="trash" iconSize={12} onClick={onClear}>
          Clear image
        </EditorButton>
      )}
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={onLibraryPick} />
    </div>
  )
}

/* File tab, default mode — settings .json save/load (file lane) above the
 * library Save/Save as (library lane); a divider keeps the lanes distinct. */
function SettingsFileTab({ onSaveSettings, onLoadSettings, onSave, onSaveAs, currentPresetId }) {
  const fileRef = useRef(null)
  const [err, setErr] = useState('')
  const onPick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' /* allow re-loading the same file */
    if (!file) return
    onLoadSettings(file)
      .then(() => setErr(''))
      .catch((ex) => setErr(ex.message || 'Load failed'))
  }
  return (
    <div className="flex flex-col gap-2">
      <EditorButton variant="primary" size="sm" className="w-full" iconLeft="download" iconSize={12} onClick={onSaveSettings}>
        Save settings
      </EditorButton>
      <EditorButton variant="primary" size="sm" className="w-full" iconLeft="upload" iconSize={12} onClick={() => fileRef.current?.click()}>
        Load settings
      </EditorButton>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onPick} />
      {err && <span className="kol-helper-10 text-ui-error">{err}</span>}
      {/* kol Divider's h-px never generates (Tailwind skips node_modules) —
          use the footer's own border-t divider idiom instead. */}
      <div className="border-t border-fg-08 my-1" />
      <EditorButton variant="primary" size="sm" className="w-full" onClick={onSave}>
        {currentPresetId ? 'Save' : 'Save…'}
      </EditorButton>
      <EditorButton variant="primary" size="sm" className="w-full" onClick={onSaveAs}>
        Save as…
      </EditorButton>
    </div>
  )
}

export default function EditorFooter() {
  const [tab, setTab] = useState('transport')
  const [pngScale, setPngScale] = useState(1)
  const {
    onSave, onSaveAs, onExportPng, onExportWebm,
    onSaveSettings, onLoadSettings, currentPresetId,
  } = useComposeFile()
  const { aspect, setAspect, canvasW, canvasH, selectedId, layers } = useComposeState()

  /* 'custom' isn't pickable (it arises from typing W/H) — but stays listed
   * while active so the dropdown reflects the frame's actual state. */
  const aspectOptions = ASPECTS
    .filter((a) => a.id !== 'custom' || aspect === 'custom')
    .map((a) => ({ value: a.id, label: a.label }))

  /* Figma-style @Nx resolution multiplier (labs SCALE_OPTIONS shape). */
  const scaleOptions = [1, 2, 3].map((k) => ({ value: k, label: `@${k}x · ${canvasW * k}` }))

  const selectedLayer = selectedId && selectedId !== 'canvas' ? findLayerDeep(layers, selectedId) : null
  const photoLayer = selectedLayer?.type === 'photo' ? selectedLayer : null

  return (
    <div className="relative border-t border-fg-08 flex flex-col gap-3" style={{ padding: '16px 20px 24px 20px' }}>
      <SegmentedToggle value={tab} onChange={setTab} options={TABS} className={TOGGLE_FIX} />
      <div className={tab === 'transport' ? undefined : 'hidden'}>
        <TransportBar />
        {/* Audio analyser input for the audio-band modulation sources. */}
        <AudioInputRow />
      </div>
      {tab === 'output' && (
        <div className="flex flex-col gap-3">
          <Section label="Aspect">
            <Dropdown size="sm" variant="subtle" className="w-full" options={aspectOptions} value={aspect} onChange={setAspect} />
          </Section>
          <Section label="Export">
            <div className="flex items-center gap-3">
              {/* 'w-full' in className opts out of Dropdown's fixed inline width
                  so flex-1 can actually size the control. */}
              <Dropdown size="sm" variant="subtle" className="flex-1 w-full" options={scaleOptions} value={pngScale} onChange={setPngScale} />
              <span className="kol-helper-10 text-meta whitespace-nowrap">{canvasW * pngScale} × {canvasH * pngScale} px</span>
            </div>
            <EditorButton variant="primary" size="sm" className="w-full" iconLeft="download" iconSize={12} onClick={() => onExportPng(pngScale)}>
              Export PNG
            </EditorButton>
            <EditorButton variant="primary" size="sm" className="w-full" iconLeft="download" iconSize={12} onClick={() => onExportWebm(pngScale)}>
              Export loop (webm)
            </EditorButton>
          </Section>
        </div>
      )}
      {tab === 'file' && (
        photoLayer
          ? <PhotoFileTab layer={photoLayer} />
          : (
            <SettingsFileTab
              onSaveSettings={onSaveSettings}
              onLoadSettings={onLoadSettings}
              onSave={onSave}
              onSaveAs={onSaveAs}
              currentPresetId={currentPresetId}
            />
          )
      )}
    </div>
  )
}
