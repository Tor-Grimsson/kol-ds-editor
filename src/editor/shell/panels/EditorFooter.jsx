import { useState } from 'react'
import { SegmentedToggle } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import TransportBar from '../../params/TransportBar'
import { useComposeFile } from '../../compose/useComposeFile'

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

export default function EditorFooter() {
  const [tab, setTab] = useState('transport')
  const { onSave, onSaveAs, onExportSvg, onExportPng, currentPresetId } = useComposeFile()

  return (
    <div className="relative border-t border-fg-08 flex flex-col gap-3" style={{ padding: '16px 20px 24px 20px' }}>
      <SegmentedToggle value={tab} onChange={setTab} options={TABS} />
      <div className={tab === 'transport' ? undefined : 'hidden'}>
        <TransportBar />
      </div>
      {tab === 'output' && (
        <div className="flex flex-col gap-2">
          <EditorButton variant="primary" size="sm" className="w-full" onClick={onExportSvg}>Export SVG</EditorButton>
          <EditorButton variant="primary" size="sm" className="w-full" onClick={onExportPng}>Export PNG</EditorButton>
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
