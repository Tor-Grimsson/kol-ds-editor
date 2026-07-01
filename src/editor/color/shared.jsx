import './color-panel.css'

export function PanelBody({ children }) {
  return (
    <div className="kol-color-panel">
      <div className="p-[14px]">
        {children}
      </div>
    </div>
  )
}

export function ChevYStack() {
  return (
    <span className="kol-color-panel-chev-y">
      <svg width="8" height="4" viewBox="0 0 8 4" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 3l3-2 3 2" /></svg>
      <svg width="8" height="4" viewBox="0 0 8 4" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M1 1l3 2 3-2" /></svg>
    </span>
  )
}
