/**
 * appSettings — editor-wide preferences, persisted to localStorage. A tiny
 * pub/sub (get / set / subscribe + a React hook) so the Settings menu and the
 * boot path stay in sync within the session. Ported from kol-labs-single
 * lib/appSettings.js, trimmed to the editor's surface.
 *
 *   getAppSettings().defaultAspect        -> '4:5'
 *   setAppSetting('autoplay', true)
 *   const { autoplay } = useAppSettings()  // reactive
 *
 * NOT the light/dark UI theme — that lives in editor/theme.js off <html
 * data-theme>. `defaultTheme` here is the LOOP PALETTE theme id (loops/lib/
 * themes: 'kol' | 'dark' | 'paper' | …) that new loop layers seed from.
 */
import { useEffect, useState } from 'react'

/* Versioned key — a schema bump (renamed/removed field) rolls the suffix so
 * stale shapes are ignored rather than merged. */
const KEY = 'kol-editor-settings'
const VERSION = 1

const DEFAULTS = {
  version: VERSION,
  defaultAspect: '4:5',   // shell/aspects id — seeds the canvas frame at boot
  defaultTheme: 'kol',    // loops/lib/themes id — seeds new loop layers' themeId
  autoplay: false,        // transport starts playing on load
  clipToFrame: true,      // new layers/exports crop to the aspect frame
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}')
    /* Drop a mismatched-version blob wholesale — no field-level migration. */
    if (raw.version !== VERSION) return { ...DEFAULTS }
    return { ...DEFAULTS, ...raw }
  } catch { return { ...DEFAULTS } }
}

let state = load()
const subs = new Set()

export function getAppSettings() { return state }

export function setAppSetting(key, value) {
  state = { ...state, [key]: value }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode — ignore */ }
  subs.forEach((fn) => fn(state))
}

export function subscribeAppSettings(fn) { subs.add(fn); return () => subs.delete(fn) }

export function useAppSettings() {
  const [s, set] = useState(state)
  useEffect(() => subscribeAppSettings(set), [])
  return s
}

/* Convenience reads — mount/boot consumers pull one field without the hook. */
export const defaultAspect     = () => state.defaultAspect || '4:5'
export const defaultLoopTheme  = () => state.defaultTheme || 'kol'
export const defaultAutoplay   = () => state.autoplay === true
export const defaultClipToFrame = () => state.clipToFrame !== false
