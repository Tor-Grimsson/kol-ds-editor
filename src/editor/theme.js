import { useCallback, useEffect, useState } from 'react'

/**
 * Theme mode — 'light' | 'dark' | 'system'. Persisted in localStorage; the
 * *effective* theme is written to <html data-theme> (kol-theme themes off that
 * attribute — it ships [data-theme="light"], [data-theme="dark"], and a
 * prefers-color-scheme default). 'system' resolves to the OS and tracks OS
 * changes live.
 *
 * The inline boot script in index.html applies the stored mode BEFORE the
 * bundle paints (no flash); this module owns runtime changes. Nothing is
 * applied at import time. An embedded <DesignEditor> applies the persisted
 * mode at component mount (index.jsx) — but only when one is actually stored
 * (hasStoredThemeMode), so a fresh embed respects the host's data-theme
 * until the user picks a mode.
 *
 * ponytail: no context/store — only the Settings menu reads the mode, so a
 * hook over localStorage is the whole mechanism.
 */
const KEY = 'kol-editor-theme'
const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)')

export const getThemeMode = () => localStorage.getItem(KEY) || 'system'

/* Has the user ever picked a mode? Gates mount-application in the embedded
 * build — no stored pick means the host's data-theme stays untouched. */
export const hasStoredThemeMode = () => {
  try { return localStorage.getItem(KEY) != null } catch { return false }
}

const resolve = (mode) =>
  mode === 'system' ? (prefersDark().matches ? 'dark' : 'light') : mode

export const applyThemeMode = (mode) =>
  document.documentElement.setAttribute('data-theme', resolve(mode))

export const setThemeMode = (mode) => {
  localStorage.setItem(KEY, mode)
  applyThemeMode(mode)
}

export function useThemeMode() {
  const [mode, setMode] = useState(getThemeMode)
  // Re-apply on OS light/dark flip while tracking 'system'.
  useEffect(() => {
    const mql = prefersDark()
    const onChange = () => { if (getThemeMode() === 'system') applyThemeMode('system') }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  const set = useCallback((next) => { setThemeMode(next); setMode(next) }, [])
  return [mode, set]
}
