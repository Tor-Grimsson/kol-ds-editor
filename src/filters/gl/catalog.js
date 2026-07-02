/**
 * GL filter catalog — DATA ONLY (defs + editor schemas). No engine imports:
 * index.js consumes this eagerly for the inspector dropdown, while the
 * three.js engines load lazily via host.js when a filtered layer renders
 * (same split as loops/gl catalog/host).
 *
 * All engine filters are time-driven and FREE-RUNNING (feedback buffers or
 * accumulated time — not seamless, labs parity): `kind:'engine'` routes the
 * renderer to EngineFilterLayer, dt-driven while the transport plays.
 * Schemas transcribed from the labs param surfaces (wave-4c port report).
 */
const range = (key, label, min, max, step, dflt) => ({ key, label, type: 'range', min, max, step, default: dflt })
const select = (key, label, dflt, options) => ({ key, label, type: 'select', default: dflt, options })
const toggle = (key, label, dflt = false) => ({ key, label, type: 'toggle', default: dflt })
const opt = (value, label) => ({ value, label })

const SPEED = range('speed', 'Speed', 0.1, 2.5, 0.05, 1)

const trails = {
  id: 'gl-trails', label: 'Trails', kind: 'engine', engine: 'trails',
  params: [
    range('decay', 'Decay', 0.8, 0.99, 0.005, 0.92),
    range('mix', 'Mix', 0, 1, 0.02, 1),
    range('taps', 'Taps', 1, 4, 1, 3),
    select('spacing', 'Spacing', 'even', [opt('even', 'Even'), opt('triplet', 'Triplet'), opt('shift', 'Shift')]),
    range('chroma', 'Chroma', 0, 1, 0.02, 0.6),
    range('zoom', 'Zoom', 0.9, 1.1, 0.002, 1),
    range('rotate', 'Rotate', -0.1, 0.1, 0.002, 0),
    range('drift', 'Drift', 0, 0.06, 0.002, 0.02),
    range('originX', 'Origin X', 0, 1, 0.01, 0.5),
    range('originY', 'Origin Y', 0, 1, 0.01, 0.5),
    range('hue', 'Hue', 0, 2, 0.02, 0),
    range('sat', 'Saturation', 0, 3, 0.05, 1),
    range('gain', 'Gain', 0.2, 2, 0.05, 1),
    SPEED,
  ],
}

const scan = {
  id: 'gl-scan', label: 'Rutt-Etra', kind: 'engine', engine: 'scan',
  params: [
    range('lines', 'Lines', 40, 300, 1, 140),
    range('cols', 'Columns', 40, 400, 1, 220),
    range('displace', 'Displace', 0, 2.5, 0.05, 1),
    toggle('mono', 'Mono'),
    { key: 'tint', label: 'Tint', type: 'color', default: '#9fe7ff' },
    range('opacity', 'Line opacity', 0.05, 1, 0.05, 1),
    range('yaw', 'Yaw', -3.14, 3.14, 0.02, 0),
    range('pitch', 'Pitch', -1.4, 1.4, 0.02, 0.4),
    range('dist', 'Distance', 1.5, 8, 0.1, 3),
    range('fov', 'FOV', 20, 90, 1, 45),
    toggle('cameraMotion', 'Camera motion'),
    select('motionPreset', 'Motion', 'orbit',
      [opt('orbit', 'Orbit'), opt('spin', 'Spin'), opt('rock', 'Rock'), opt('rise', 'Rise'), opt('push', 'Push'), opt('pull', 'Pull')]),
    range('motionSpeed', 'Motion speed', 0.02, 1.5, 0.02, 0.3),
    { key: 'bg', label: 'Backdrop', type: 'color', role: 'bg', default: '#0b0e13' },
    SPEED,
  ],
}

/* NB: on a still photo slitscan converges to near-identity once the head
 * sweeps — it shines on changing sources. Kept for parity; the animated
 * scroll still reads on stills via smooth/orig. */
const slitscan = {
  id: 'gl-slitscan', label: 'Slitscan', kind: 'engine', engine: 'slitscan',
  params: [
    select('mode', 'Mode', 'chop', [opt('chop', 'Chop'), opt('finish', 'Finish')]),
    select('axis', 'Axis', 'horizontal', [opt('horizontal', 'Horizontal'), opt('vertical', 'Vertical')]),
    range('slit', 'Slit', 0, 1, 0.01, 0.5),
    range('scroll', 'Scroll', 0, 4, 0.05, 1),
    range('smooth', 'Smooth', 0, 1, 0.02, 0),
    range('orig', 'Original mix', 0, 1, 0.02, 0),
    toggle('invert', 'Invert'),
    SPEED,
  ],
}

const disco = {
  id: 'gl-disco', label: 'Disco', kind: 'engine', engine: 'disco',
  params: [
    select('mirror', 'Mirror', 'kaleido',
      [opt('none', 'None'), opt('kaleido', 'Kaleido'), opt('mirrorX', 'Mirror X'), opt('mirrorY', 'Mirror Y'), opt('quad', 'Quad')]),
    range('segments', 'Segments', 1, 16, 1, 6),
    range('twist', 'Twist', -3.14, 3.14, 0.02, 0),
    range('originX', 'Origin X', 0, 1, 0.01, 0.5),
    range('originY', 'Origin Y', 0, 1, 0.01, 0.5),
    range('zoomX', 'Zoom X', 0.2, 4, 0.05, 1),
    range('zoomY', 'Zoom Y', 0.2, 4, 0.05, 1),
    range('rotate', 'Rotate', -3.14, 3.14, 0.02, 0),
    range('spin', 'Spin', -2, 2, 0.05, 0.1),
    range('pulse', 'Pulse', 0, 1, 0.02, 0),
    range('pulseRate', 'Pulse rate', 0, 4, 0.05, 0.5),
    range('hue', 'Hue', 0, 2, 0.02, 0.3),
    range('sat', 'Saturation', 0, 3, 0.05, 1),
    range('posterize', 'Posterize', 0, 12, 1, 0),
    range('strobe', 'Strobe', 0, 12, 0.5, 0),
    SPEED,
  ],
}

/* px/py are the trail center (0..1) — bind Mouse X / Mouse Y on them for the
 * labs cursor behavior; motionShape drives it hands-free. */
const distort = {
  id: 'gl-distort', label: 'Distortion', kind: 'engine', engine: 'distort',
  params: [
    range('strength', 'Strength', 0, 0.6, 0.01, 0.25),
    range('radius', 'Radius', 0.02, 0.5, 0.01, 0.18),
    range('decay', 'Decay', 0.8, 0.99, 0.005, 0.94),
    range('rgbShift', 'RGB shift', 0, 0.1, 0.002, 0.03),
    range('px', 'Pointer X', 0, 1, 0.01, 0.5),
    range('py', 'Pointer Y', 0, 1, 0.01, 0.5),
    select('motionShape', 'Auto path', 'orbit',
      [opt('off', 'Off'), opt('orbit', 'Orbit'), opt('figure8', 'Figure 8'), opt('lissajous', 'Lissajous'), opt('sweep', 'Sweep'), opt('spiral', 'Spiral')]),
    range('motionSpeed', 'Path speed', 0, 4, 0.05, 1),
    range('motionSize', 'Path size', 0, 1, 0.02, 0.6),
    SPEED,
  ],
}

const lens = {
  id: 'gl-lens', label: 'Lens', kind: 'engine', engine: 'lens',
  params: [
    select('type', 'Surface', 'glass',
      [opt('glass', 'Glass'), opt('ripple', 'Ripple'), opt('ice', 'Ice'), opt('mirror', 'Mirror'), opt('kaleido', 'Kaleido'), opt('waves', 'Waves')]),
    select('shape', 'Shape', 'panel', [opt('panel', 'Panel'), opt('circle', 'Circle')]),
    range('size', 'Size', 0.05, 0.7, 0.01, 0.34),
    range('radius', 'Corner radius', 0, 0.3, 0.005, 0.08),
    range('glassX', 'Lens X', 0, 1, 0.01, 0.5),
    range('glassY', 'Lens Y', 0, 1, 0.01, 0.5),
    range('magnify', 'Magnify', 0, 1, 0.02, 0.22),
    range('depth', 'Depth', 0, 120, 1, 40),
    range('chromatic', 'Chromatic', 0, 40, 0.5, 8),
    range('frost', 'Frost', 0, 20, 0.5, 0),
    range('scale', 'Detail', 0, 1, 0.02, 0.4),
    range('reflect', 'Reflect', 0, 1.5, 0.05, 0.1),
    range('sheen', 'Sheen', 0, 1.5, 0.05, 0.5),
    range('lightAngle', 'Light angle', 0, 360, 1, 45),
    { key: 'tint', label: 'Tint', type: 'color', default: '#ffffff' },
    range('tintAmt', 'Tint amount', 0, 1, 0.02, 0),
    { key: 'bg', label: 'Backdrop', type: 'color', role: 'bg', default: '#06070b' },
    range('flow', 'Flow', 0, 2.5, 0.05, 1),
  ],
}

export const GL_FILTERS = [trails, scan, slitscan, disco, distort, lens]
