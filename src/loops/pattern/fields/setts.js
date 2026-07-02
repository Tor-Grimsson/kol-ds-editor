// Tartan threadcount setts. Each sett = ordered bands [paletteIndex, threadCount];
// paletteIndex 0..3 → [color, color2, color3, bg]. Real setts are palindromic, so
// sym() mirrors a half-sett (drop the shared end thread on the reflection). Colours
// come from the preset (so a tartan stays retintable); the sett owns only the
// thread WIDTHS + which palette role each band is.
const sym = (half) => [...half, ...half.slice(1, -1).reverse()]

export const SETTS = {
  gingham:       [[3, 8], [0, 8]],                                       // ground · colour (even check)
  buffalo:       [[0, 12], [1, 12]],                                     // two bold colours
  'black-watch': sym([[0, 16], [2, 4], [1, 16], [2, 4]]),               // navy · black · green · black
  hunting:       sym([[1, 18], [2, 4], [0, 12], [2, 4]]),               // green · black · navy
  royal:         sym([[0, 22], [3, 2], [1, 4], [3, 2], [0, 8], [2, 4]]), // red ground + white/navy/green over
  madras:        sym([[0, 12], [1, 4], [2, 10], [1, 4]]),               // 3-colour colourway
  tattersall:    sym([[3, 22], [0, 2], [3, 22], [1, 2]]),               // ground + two thin overchecks
  windowpane:    sym([[0, 30], [1, 3]]),                                // ground + sparse line
  glen:          sym([[3, 6], [0, 6], [3, 2], [0, 2]]),                 // fine glen-ish check
}

export const SETT_OPTIONS = Object.keys(SETTS).map((k) => ({
  value: k,
  label: k.replace(/(^|-)([a-z])/g, (_, s, c) => (s ? ' ' : '') + c.toUpperCase()),
}))
