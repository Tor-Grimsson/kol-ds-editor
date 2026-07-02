import { Component } from 'react'

/**
 * EditorErrorBoundary — last line of defense around the editor tree. A render
 * or unmount crash used to blank the whole app, and because the localStorage
 * draft faithfully restored the crashing state, a refresh stayed blank ("too
 * persistent"). This boundary catches the crash and offers two ways out:
 * reload (keep the draft — for transient errors) or reset (discard the draft
 * — the guaranteed recovery).
 *
 * Hard refresh deliberately does NOT clear the draft: that persistence is
 * what makes accidental reloads safe. The reset button here is the escape
 * hatch for the poisoned-draft case.
 */
export default class EditorErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[editor] crashed:', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 h-dvh"
        style={{ background: 'var(--kol-surface-primary)', color: 'var(--kol-fg-1)' }}
      >
        <span className="kol-helper-12 text-emphasis">The editor hit an error.</span>
        <span className="kol-helper-12 text-meta max-w-[420px] text-center">
          {String(this.state.error?.message ?? this.state.error)}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="kol-helper-12 px-3 py-2 rounded border border-fg-08 text-emphasis"
            style={{ background: 'var(--kol-surface-secondary)', cursor: 'pointer' }}
            onClick={() => window.location.reload()}
          >
            Reload (keep canvas)
          </button>
          <button
            type="button"
            className="kol-helper-12 px-3 py-2 rounded border border-fg-08 text-emphasis"
            style={{ background: 'var(--kol-surface-secondary)', cursor: 'pointer' }}
            onClick={() => {
              try { localStorage.removeItem('kol.editor.draft') } catch { /* ignore */ }
              window.location.reload()
            }}
          >
            Reset canvas and reload
          </button>
        </div>
      </div>
    )
  }
}
