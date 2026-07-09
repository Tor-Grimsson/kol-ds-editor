import { useRef, useState } from 'react'
import { SegmentedToggle } from '@kolkrabbi/kol-component'
import { enableAudio, disableAudio, audioSourceKind } from './audioBands'

/**
 * AudioInputRow — picks the analyser input for the audio-band modulation
 * sources (Off · Mic · File, labs order). File opens a picker and loops the
 * upload audibly through the analyser. Binding an audio source also
 * auto-enables the mic (ensure()) — this row is for switching to a track
 * or turning the analyser off.
 */
const OPTIONS = [
  { value: 'off',  label: 'Off' },
  { value: 'mic',  label: 'Mic' },
  { value: 'file', label: 'File' },
]

export default function AudioInputRow() {
  const [kind, setKind] = useState(audioSourceKind() ?? 'off')
  /* Surface WHY the analyser failed — `enableAudio` swallows the error
   * (returns false), so without this the toggle silently snaps back to Off
   * and the mic just "doesn't open" with no clue. */
  const [err, setErr] = useState(null)
  const fileRef = useRef(null)

  const onPick = async (v) => {
    setErr(null)
    if (v === 'off') {
      disableAudio()
      setKind('off')
    } else if (v === 'mic') {
      /* getUserMedia only exists in a secure context — http on a LAN IP has
       * no `navigator.mediaDevices`, so the mic never prompts. Say so. */
      if (!window.isSecureContext) {
        setErr('Mic needs https or localhost')
        setKind('off')
        return
      }
      const ok = await enableAudio()
      setKind(ok ? 'mic' : 'off')
      if (!ok) setErr('Mic blocked — allow it for this site (check the address bar)')
    } else {
      fileRef.current?.click()   /* kind commits when a file lands */
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr(null)
    const ok = await enableAudio({ file })
    setKind(ok ? 'file' : 'off')
    if (!ok) setErr('Could not play that audio file')
  }

  return (
    <div className="flex flex-col gap-1 mt-3">
      <div className="flex items-center gap-2">
        <span className="kol-helper-10 text-meta shrink-0">Audio</span>
        <SegmentedToggle value={kind} onChange={onPick} options={OPTIONS} className="flex-1" />
        <input ref={fileRef} type="file" accept="audio/*" onChange={onFile} className="hidden" />
      </div>
      {err && <span className="kol-helper-10" style={{ color: 'var(--kol-fg-64)' }}>{err}</span>}
    </div>
  )
}
