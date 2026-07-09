// Library entry — the embeddable editor package (@kolkrabbi/design-editor).
// The standalone app boots from main.jsx instead; this file is ONLY the
// npm/library surface. Nothing in the app imports it.
//
// CSS: index.lib.css, NOT the app's index.css — the app sheet ships Tailwind
// preflight + framework page chrome, which would restyle the HOST page when
// the built dist/design-editor.css is imported. The lib sheet scopes its
// resets under .kol-design-editor (the root class stamped below).
import './index.lib.css'
import { useEffect } from 'react'
import Editor from './editor/Editor'
import { setMediaProxyBase } from './editor/library/mediaLibrary'
import { applyThemeMode, getThemeMode, hasStoredThemeMode } from './editor/theme'

/**
 * <DesignEditor /> — the whole editor as one embeddable component.
 *
 * @param {object}  props
 * @param {string} [props.mediaProxyBase='/media/'] same-origin path the host
 *   proxies to https://media.kolkrabbi.io. Load-bearing for photo-filter and
 *   export paths: the CDN sends no CORS headers, so a cross-origin media load
 *   taints the canvas. Stand up a rewrite on your host (e.g. /media/* → the
 *   CDN) and pass its path here. Default assumes the host proxies `/media`.
 */
export function DesignEditor({ mediaProxyBase } = {}) {
  // ponytail: module-global config knob, set at render — idempotent, runs
  // before children mount. A context/prop-drill would be pure ceremony here.
  if (mediaProxyBase != null) setMediaProxyBase(mediaProxyBase)

  // Apply the persisted theme choice on mount (the app does this pre-paint in
  // index.html; embeds have no boot script). Without it, Settings → Theme
  // shows the stored mode as selected while it isn't in effect. A fresh embed
  // (nothing stored) keeps the host's data-theme untouched.
  useEffect(() => {
    if (hasStoredThemeMode()) applyThemeMode(getThemeMode())
  }, [])

  return (
    <div className="kol-design-editor">
      <Editor />
    </div>
  )
}

export default DesignEditor
