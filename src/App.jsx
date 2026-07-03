import { Routes, Route, Navigate } from 'react-router-dom'
import Editor from './editor/Editor'

// Standalone editor host. The editor is the whole app here — no portal chrome.
// It lives at `/`; legacy `/editor` and `/editor/*` URLs redirect there.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Editor />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
