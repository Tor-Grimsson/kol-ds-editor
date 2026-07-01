import { Routes, Route, Navigate } from 'react-router-dom'
import Editor from './editor/Editor'

// Standalone editor host. The editor is the whole app here — no portal chrome.
// `/editor/:mode` (compose | palette | pattern | type); anything else lands on compose.
export default function App() {
  return (
    <Routes>
      <Route path="/editor/:mode" element={<Editor />} />
      <Route path="*" element={<Navigate to="/editor/compose" replace />} />
    </Routes>
  )
}
