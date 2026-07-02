import { TAU } from '../lib/util.js'

// The field-loop camera — the viewer's path THROUGH a 2D field over u. A field
// loop is sampled per pixel/cell; the camera transforms the sample coordinates
// (zoom + rotate) and supplies a `phase` that drifts the field temporally (the
// "flow" — moving through it). `camFlow` is in whole cycles per loop, so an
// integer keeps the loop seamless.
//
// Every field loop appends CAMERA_SCHEMA to its params → a Camera rail tab.

export const CAMERA_SCHEMA = [
  { key: 'camZoom', label: 'Zoom', type: 'range', min: 0.25, max: 3, step: 0.05, default: 1 },
  { key: 'camFlow', label: 'Flow', type: 'range', min: 0, max: 4, step: 1, default: 1 },
  { key: 'camAngle', label: 'Angle', type: 'range', min: 0, max: 360, step: 1, default: 0 },
]

export function makeCam(u, p, w, h) {
  const ang = (p.camAngle || 0) * Math.PI / 180
  return {
    cos: Math.cos(ang),
    sin: Math.sin(ang),
    zoom: p.camZoom || 1,
    cx: w / 2,
    cy: h / 2,
    phase: u * TAU * Math.round(p.camFlow || 0),
  }
}

// Screen px → field space: centre, rotate, divide by zoom.
export function sample(cam, x, y) {
  const dx = x - cam.cx
  const dy = y - cam.cy
  return [
    (dx * cam.cos - dy * cam.sin) / cam.zoom,
    (dx * cam.sin + dy * cam.cos) / cam.zoom,
  ]
}
