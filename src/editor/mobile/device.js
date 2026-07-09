/* Mobile-chrome gating. Primary-pointer coarse + real touch = phone/tablet →
 * the generative MobileView; a tablet with a keyboard/trackpad reports a fine
 * primary pointer and gets the desktop editor natively. */
export const isMobileDevice = () =>
  window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0

/* Tablets get the "Use desktop editor" opt-in on the entry screen; phones
 * don't. ~600px shortest screen side is the phone/tablet line. */
export const isTabletSized = () =>
  Math.min(window.screen.width, window.screen.height) >= 600

/* The persisted tablet opt-in. `?view=mobile` clears it (the way back). */
const DESKTOP_KEY = 'kol-editor:mobile-use-desktop'
export const wantsDesktop = () => {
  try { return localStorage.getItem(DESKTOP_KEY) === '1' } catch { return false }
}
export const setWantsDesktop = (on) => {
  try { on ? localStorage.setItem(DESKTOP_KEY, '1') : localStorage.removeItem(DESKTOP_KEY) } catch { /* storage blocked */ }
}

/* View switches — navigate to the explicit `?view=` route rather than
 * flag+reload. A forced `?view=mobile` URL would survive a reload and loop, so
 * the way OUT must set the URL, not just the flag. `goDesktop` also persists
 * the preference so a tablet's plain (no-param) reload stays on desktop. */
const withView = (view) => `${window.location.pathname}?view=${view}`
export const goDesktop = () => { setWantsDesktop(true); window.location.assign(withView('desktop')) }
export const goMobile = () => window.location.assign(withView('mobile'))
