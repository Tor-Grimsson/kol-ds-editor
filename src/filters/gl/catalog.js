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
    /* uLock — mixes the trail toward the locked 70s palette (labs "70s lock",
     * a 0–1 amount, not a switch) */
    range('palette', '70s lock', 0, 1, 0.02, 0),
    range('gain', 'Gain', 0.2, 2, 0.05, 1),
    /* the clock only feeds the hue cycle (feedback decay is per-frame) */
    { ...SPEED, when: (l) => (l.hue ?? 0) > 0 },
  ],
}

const scan = {
  id: 'gl-scan', label: 'Rutt-Etra', kind: 'engine', engine: 'scan', orbit: true,
  params: [
    /* noRandom: lines/cols are scan-grid resolution — structural, not look. */
    { ...range('lines', 'Lines', 40, 300, 1, 140), noRandom: true },
    { ...range('cols', 'Columns', 40, 400, 1, 220), noRandom: true },
    range('displace', 'Displace', 0, 2.5, 0.05, 1),
    toggle('mono', 'Mono'),
    /* tint only mixes in on the mono path */
    { key: 'tint', label: 'Tint', type: 'color', default: '#9fe7ff', when: (l) => !!l.mono },
    range('opacity', 'Line opacity', 0.05, 1, 0.05, 1),
    /* manual rig vs motion preset — each side yields to the other */
    { ...range('yaw', 'Yaw', -3.14, 3.14, 0.02, 0), when: (l) => !l.cameraMotion },
    { ...range('pitch', 'Pitch', -1.4, 1.4, 0.02, 0.4), when: (l) => !l.cameraMotion },
    { ...range('dist', 'Distance', 1.5, 8, 0.1, 3), when: (l) => !l.cameraMotion },
    range('fov', 'FOV', 20, 90, 1, 45),
    toggle('cameraMotion', 'Camera motion'),
    { ...select('motionPreset', 'Motion', 'orbit',
      [opt('orbit', 'Orbit'), opt('spin', 'Spin'), opt('rock', 'Rock'), opt('rise', 'Rise'), opt('push', 'Push'), opt('pull', 'Pull')]), when: (l) => !!l.cameraMotion },
    { ...range('motionSpeed', 'Motion speed', 0.02, 1.5, 0.02, 0.3), when: (l) => !!l.cameraMotion },
    { key: 'bg', label: 'Backdrop', type: 'color', role: 'bg', default: '#0b0e13' },
    /* clear-alpha — 0 lets the layer stack show through behind the scan grid */
    range('bgAlpha', 'Backdrop opacity', 0, 1, 0.01, 1),
    /* the clock only drives the camera-motion presets */
    { ...SPEED, when: (l) => !!l.cameraMotion },
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
    /* the fixed slit line only exists in finish mode (chop writes the live frame) */
    { ...range('slit', 'Slit', 0, 1, 0.01, 0.5), when: (l) => l.mode === 'finish' },
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
    { ...range('segments', 'Segments', 1, 16, 1, 6), when: (l) => (l.mirror ?? 'kaleido') === 'kaleido' },
    range('twist', 'Twist', -3.14, 3.14, 0.02, 0),
    range('originX', 'Origin X', 0, 1, 0.01, 0.5),
    range('originY', 'Origin Y', 0, 1, 0.01, 0.5),
    range('zoomX', 'Zoom X', 0.2, 4, 0.05, 1),
    range('zoomY', 'Zoom Y', 0.2, 4, 0.05, 1),
    range('panX', 'Pan X', -1, 1, 0.01, 0),
    range('panY', 'Pan Y', -1, 1, 0.01, 0),
    range('rotate', 'Rotate', -3.14, 3.14, 0.02, 0),
    range('spin', 'Spin', -2, 2, 0.05, 0.1),
    /* uDrift — continuous pan velocity on top of the static panX/panY */
    range('driftX', 'Drift X', -0.5, 0.5, 0.005, 0),
    range('driftY', 'Drift Y', -0.5, 0.5, 0.005, 0),
    range('pulse', 'Pulse', 0, 1, 0.02, 0),
    { ...range('pulseRate', 'Pulse rate', 0, 4, 0.05, 0.5), when: (l) => (l.pulse ?? 0) > 0 },
    range('hue', 'Hue', 0, 2, 0.02, 0.3),
    range('sat', 'Saturation', 0, 3, 0.05, 1),
    /* uLock — mixes toward the locked 70s palette (labs 0–1 amount) */
    range('palette', '70s lock', 0, 1, 0.02, 0),
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
    /* an active auto path re-targets the point every frame — px/py only steer
     * with the path off, and the path knobs only matter with it on */
    { ...range('px', 'Pointer X', 0, 1, 0.01, 0.5), when: (l) => (l.motionShape ?? 'orbit') === 'off' },
    { ...range('py', 'Pointer Y', 0, 1, 0.01, 0.5), when: (l) => (l.motionShape ?? 'orbit') === 'off' },
    select('motionShape', 'Auto path', 'orbit',
      [opt('off', 'Off'), opt('orbit', 'Orbit'), opt('figure8', 'Figure 8'), opt('lissajous', 'Lissajous'), opt('sweep', 'Sweep'), opt('spiral', 'Spiral')]),
    { ...range('motionSpeed', 'Path speed', 0, 4, 0.05, 1), when: (l) => (l.motionShape ?? 'orbit') !== 'off' },
    { ...range('motionSize', 'Path size', 0, 1, 0.02, 0.6), when: (l) => (l.motionShape ?? 'orbit') !== 'off' },
    /* radius breathe along the auto path (engine motion.pulse) */
    { ...range('motionPulse', 'Path pulse', 0, 1, 0.01, 0), when: (l) => (l.motionShape ?? 'orbit') !== 'off' },
    /* Cursor record/replay (labs radar DistortPage): with the auto path off,
     * Record captures a pointer gesture over the layer body (hover) into
     * `cursorPath`; Replay then drives the point along it hands-free, sampled
     * by transport phase. `cursorPath` (the recorded track) rides on the layer
     * as data — not a slider, so it has no schema entry; the engine reads it
     * through the flat param bag. Re-recording clears the prior track. */
    { ...toggle('cursorRecord', 'Record cursor'), when: (l) => (l.motionShape ?? 'orbit') === 'off' },
    /* Shown whenever the pointer is manual — the engine no-ops replay until a
     * track of ≥2 samples exists, so it's inert (not broken) before a record. */
    { ...toggle('cursorReplay', 'Replay cursor'), when: (l) => (l.motionShape ?? 'orbit') === 'off' },
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
    /* the SDF's circle branch has no corners */
    { ...range('radius', 'Corner radius', 0, 0.3, 0.005, 0.08), when: (l) => (l.shape ?? 'panel') !== 'circle' },
    /* uEdge — rim highlight width along the lens boundary (labs dflt 0.025) */
    range('edge', 'Edge', 0, 0.08, 0.002, 0.025),
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
    range('tintAmt', 'Tint amount', 0, 1, 0.02, 0),
    { key: 'tint', label: 'Tint', type: 'color', default: '#ffffff', when: (l) => (l.tintAmt ?? 0) > 0 },
    /* NB: the engine's `bg` only paints contain-mode bars, and `fit` is pinned
     * to cover here — param removed as unreachable (audit). */
    range('flow', 'Flow', 0, 2.5, 0.05, 1),
  ],
}

export const GL_FILTERS = [trails, scan, slitscan, disco, distort, lens]
