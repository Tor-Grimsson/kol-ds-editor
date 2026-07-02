import { useParams, Navigate } from 'react-router-dom'
import usePageTitle from '../components/hooks/usePageTitle'
import EditorErrorBoundary from './EditorErrorBoundary'
import { ToolProvider }       from './state/tools'
import { useGlobalShortcuts } from './state/useGlobalShortcuts'
import './registry/modes'      // side-effect: registers the mode features
import { getFeatures, getFeature } from './registry/features'

/**
 * Editor — `/editor/:mode` route component.
 *
 * Mounts every feature's state provider once (order = registration order,
 * outermost first), then dispatches to the active feature's body. Providers
 * stay mounted so state persists across mode switches. The mode list is the
 * feature registry — no hardcoded switch/title map here.
 */
function ActiveMode() {
  const { mode } = useParams()
  const feature = getFeature(mode)
  usePageTitle(feature?.title ?? 'Editor')
  /* Cross-mode shortcuts (undo / redo / deselect) — mounted at the route
   * level so palette / pattern / type modes get keyboard too, not just
   * Compose's CanvasArea. */
  useGlobalShortcuts()
  if (!feature?.Body) return <Navigate to="/editor/compose" replace />
  const Body = feature.Body
  return <Body />
}

export default function Editor() {
  /* Wrap ActiveMode in each feature's provider, outermost = first registered. */
  const tree = getFeatures().reduceRight(
    (children, f) => (f.Provider ? <f.Provider>{children}</f.Provider> : children),
    <ActiveMode />,
  )
  return (
    <EditorErrorBoundary>
      <ToolProvider>{tree}</ToolProvider>
    </EditorErrorBoundary>
  )
}
