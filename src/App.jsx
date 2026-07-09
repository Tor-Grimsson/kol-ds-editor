import Editor from './editor/Editor'
import OutputView from './editor/OutputView'
import MobileView from './editor/mobile/MobileView'
import { isMobileDevice, wantsDesktop, setWantsDesktop } from './editor/mobile/device'

// Standalone editor host. `?view=output` opens the chromeless OutputView (a
// clean full-screen recording surface in its own tab); `?view=desktop` /
// `?view=mobile` force a chrome (mobile also clears the tablet's persisted
// desktop opt-in — the way back). Otherwise touch-primary devices get the
// generative MobileView and everything else the editor. Still no router.
export default function App() {
  const view = new URLSearchParams(window.location.search).get('view')
  if (view === 'output') return <OutputView />
  if (view === 'desktop') return <Editor />
  if (view === 'mobile') {
    setWantsDesktop(false)
    return <MobileView />
  }
  return isMobileDevice() && !wantsDesktop() ? <MobileView /> : <Editor />
}
