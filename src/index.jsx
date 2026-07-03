// Library entry — the embeddable editor package (@kolkrabbi/design-editor).
// The standalone app boots from main.jsx instead; this file is ONLY the
// npm/library surface. Nothing in the app imports it.
import './index.css'
import { MemoryRouter } from 'react-router-dom'
import Editor from './editor/Editor'
import { setMediaProxyBase } from './editor/library/mediaLibrary'

/**
 * <DesignEditor /> — the whole editor as one embeddable component.
 *
 * Wrapped in a MemoryRouter so the editor's internal navigation never touches
 * the host app's URL bar (a BrowserRouter would). The host mounts this
 * anywhere; the editor owns no route of its own.
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
  return (
    <MemoryRouter>
      <Editor />
    </MemoryRouter>
  )
}

export default DesignEditor
