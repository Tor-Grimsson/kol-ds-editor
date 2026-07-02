import { useState } from 'react'
import { SegmentedToggle } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import TransportBar from '../../params/TransportBar'
import { useComposeFile } from '../../compose/useComposeFile'
import { useComposeState } from '../../compose/state'

/**
 * EditorFooter — the tabbed rail footer, ported from the labs standard
 * (kol-labs-single `RailFooterTabs` + `EditorFooter`). Pinned below the
 * right rail's scroll body via the `right.footer` panel slot.
 *
 *   Transport · Output · File
 *     Transport — the playback TransportBar (stays mounted hidden so the
 *                 `f` fps binding survives tab switches, per labs)
 *     Output    — export actions (same handlers as the topbar File menu)
 *     File      — frame save / save-as (same handlers, via useComposeFile)
 */
const TABS = [
  { value: 'transport', label: 'Transport' },
  { value: 'output', label: 'Output' },
  { value: 'file', label: 'File' },
]

/* PNG resolution multiplier (Figma-style @Nx). SVG is vector — unaffected. */
const SCALE_OPTIONS = [
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
]

export default function EditorFooter() {
  const [tab, setTab] = useState('transport')
  const [pngScale, setPngScale] = useState(1)
  const { onSave, onSaveAs, onExportSvg, onExportPng, currentPresetId } = useComposeFile()
  const { canvasW, canvasH } = useComposeState()

  return (
    <div className="relative border-t border-fg-08 flex flex-col gap-3" style={{ padding: '16px 20px 24px 20px' }}>
      <SegmentedToggle value={tab} onChange={setTab} options={TABS} />
      <div className={tab === 'transport' ? undefined : 'hidden'}>
        <TransportBar />
      </div>
      {tab === 'output' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <SegmentedToggle value={pngScale} onChange={setPngScale} options={SCALE_OPTIONS} className="flex-1" />
            <span className="kol-helper-10 text-meta whitespace-nowrap">{canvasW * pngScale} × {canvasH * pngScale} px</span>
          </div>
          <EditorButton variant="primary" size="sm" className="w-full" onClick={onExportSvg}>Export SVG</EditorButton>
          <EditorButton variant="primary" size="sm" className="w-full" onClick={() => onExportPng(pngScale)}>Export PNG</EditorButton>
        </div>
      )}
      {tab === 'file' && (
        <div className="flex flex-col gap-2">
          <EditorButton variant="primary" size="sm" className="w-full" onClick={onSave}>
            {currentPresetId ? 'Save' : 'Save…'}
          </EditorButton>
          <EditorButton variant="primary" size="sm" className="w-full" onClick={onSaveAs}>
            Save as…
          </EditorButton>
        </div>
      )}
    </div>
  )
}
