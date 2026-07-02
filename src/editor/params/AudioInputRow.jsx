import { useRef, useState } from 'react'
import { SegmentedToggle } from '@kolkrabbi/kol-component'
import { enableAudio, disableAudio, audioSourceKind } from './audioBands'

/**
 * AudioInputRow — picks the analyser input for the audio-band modulation
 * sources (Off · Mic · Track). Track opens a file picker and loops the
 * upload audibly through the analyser. Binding an audio source also
 * auto-enables the mic (ensure()) — this row is for switching to a track
 * or turning the analyser off.
 */
const OPTIONS = [
  { value: 'off',  label: 'Off' },
  { value: 'mic',  label: 'Mic' },
  { value: 'file', label: 'Track' },
]

export default function AudioInputRow() {
  const [kind, setKind] = useState(audioSourceKind() ?? 'off')
  const fileRef = useRef(null)

  const onPick = async (v) => {
    if (v === 'off') {
      disableAudio()
      setKind('off')
    } else if (v === 'mic') {
      const ok = await enableAudio()
      setKind(ok ? 'mic' : 'off')
    } else {
      fileRef.current?.click()   /* kind commits when a file lands */
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const ok = await enableAudio({ file })
    setKind(ok ? 'file' : 'off')
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <span className="kol-helper-10 text-meta shrink-0">Audio</span>
      <SegmentedToggle value={kind} onChange={onPick} options={OPTIONS} className="flex-1" />
      <input ref={fileRef} type="file" accept="audio/*" onChange={onFile} className="hidden" />
    </div>
  )
}
