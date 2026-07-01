import { useState } from 'react'
import { PanelBody, ChevYStack } from './shared'

const MODES = ['Hue', 'Wheel', 'Sliders']

export default function ColourPanelRef() {
  const [mode, setMode]         = useState('Hue')
  const [modeOpen, setModeOpen] = useState(false)

  return (
    <PanelBody>
      <div className="flex items-center gap-3 mb-[14px]">
        <SwatchStack />
        <Eyedropper />
        <ModeSelect mode={mode} setMode={setMode} open={modeOpen} setOpen={setModeOpen} />
      </div>

      {mode === 'Hue'     && <HueMode     />}
      {mode === 'Wheel'   && <WheelMode   />}
      {mode === 'Sliders' && <SlidersMode />}

      <p className="kol-color-panel-uplabel mt-3 mb-2">Opacity</p>
      <div className="flex items-center gap-[10px]">
        <div className="w-[14px] h-[14px] rounded-full border border-[#333] flex-none" style={{ background: '#d4d4d4' }} />
        <div className="kol-color-panel-op-track">
          <div className="kol-color-panel-op-handle" style={{ left: '100%' }} />
        </div>
        <div className="kol-color-panel-op-input flex items-center gap-1 justify-between">
          <span>100</span>
          <span className="text-[#6a6a6a] mr-[2px]">%</span>
          <ChevYStack />
        </div>
      </div>
    </PanelBody>
  )
}

function SwatchStack() {
  const [front, setFront] = useState('b')
  return (
    <div className="kol-color-panel-swatch-stack">
      <div className={`kol-color-panel-ring ${front === 'a' ? 'is-front' : 'is-back'}`} onClick={() => setFront('a')} />
      <div className={`kol-color-panel-ring ${front === 'b' ? 'is-front' : 'is-back'}`} onClick={() => setFront('b')} />
      <svg className="kol-color-panel-swap" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5 C 4 3, 8 3, 10 5" />
        <path d="M8.5 3.2 L10 5 L8.2 6" />
        <path d="M11 9 C 10 11, 6 11, 4 9" />
        <path d="M5.5 10.8 L4 9 L5.8 8" />
      </svg>
      <div className="kol-color-panel-none" />
    </div>
  )
}

function Eyedropper() {
  return (
    <div className="flex items-center gap-[6px] text-[#8a8a8a]">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="11" y="2" width="6" height="4" rx="1" transform="rotate(45 14 4)" />
        <path d="M13 6 L6 13 L4 16 L3 17 L4 18 L5 17 L7 15 L14 8" />
        <path d="M11.5 7.5 L13.5 9.5" />
      </svg>
      <div className="kol-color-panel-eyedrop-swatch" />
    </div>
  )
}

function ModeSelect({ mode, setMode, open, setOpen }) {
  return (
    <div
      className="kol-color-panel-mode-select ml-auto flex items-center justify-between gap-[6px] py-[5px] pl-[10px] pr-2"
      onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
    >
      <span>{mode}</span>
      <ChevYStack />
      {open && (
        <div className="kol-color-panel-mode-menu">
          {MODES.map((m) => (
            <div
              key={m}
              className={`kol-color-panel-mode-item${m === mode ? ' is-active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setMode(m); setOpen(false) }}
            >
              {m}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HueMode() {
  return (
    <>
      <div className="kol-color-panel-hue mb-3">
        <div className="kol-color-panel-handle is-hue" style={{ left: '58%', top: '50%' }} />
      </div>
      <div className="kol-color-panel-sb mb-[14px]">
        <div className="kol-color-panel-handle" style={{ left: '92%', top: '30%' }} />
      </div>
    </>
  )
}

function WheelMode() {
  return (
    <div className="kol-color-panel-wheel-wrap mb-[14px]">
      <div className="kol-color-panel-wheel" />
      <div className="kol-color-panel-handle" style={{ left: '6%', top: '50%' }} />
      <div className="kol-color-panel-triangle-wrap">
        <div className="kol-color-panel-triangle" />
        <div className="kol-color-panel-handle is-tri" style={{ left: '50%', top: '50%' }} />
      </div>
    </div>
  )
}

function SlidersMode() {
  const rows = [
    { label: 'R', pos: 24, val: 61  },
    { label: 'G', pos: 63, val: 160 },
    { label: 'B', pos: 78, val: 199 },
  ]
  return (
    <>
      <div className="grid items-center gap-x-[10px] gap-y-[10px] mb-3" style={{ gridTemplateColumns: '14px 1fr 56px' }}>
        {rows.map((r) => (
          <Slider key={r.label} {...r} />
        ))}
      </div>
      <div className="kol-color-panel-pal-strip mb-[14px]" />
    </>
  )
}

function Slider({ label, pos, val }) {
  return (
    <>
      <div className="text-[11px] text-[#8a8a8a]">{label}</div>
      <div className="kol-color-panel-slider-track">
        <div className="kol-color-panel-handle" style={{ left: `${pos}%`, top: '50%' }} />
      </div>
      <input className="kol-color-panel-num-input" defaultValue={val} />
    </>
  )
}
