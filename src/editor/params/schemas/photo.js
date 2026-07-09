/**
 * Photo-layer param schema (Phase 1 breadth). Source upload / preview /
 * clear stays hand-wired in LayerInspector (file input + object lifecycle,
 * not a tunable knob).
 *
 * Video sources (srcType 'video') add transport-governed playback knobs —
 * applied by LayerRenderer's video paths (plain / canvas-filtered / GL).
 * Trim in/out (trimIn/trimOut, normalized 0–1 of the clip duration) bound
 * the loop window: playback wraps to trimIn at trimOut (or pauses there when
 * videoLoop is off) and transport-rewind snaps to trimIn.
 */
const isVideo = (l) => l.srcType === 'video'
const isWebcam = (l) => l.srcType === 'webcam'
const pct = (v) => `${Math.round(v * 100)}%`

export const PHOTO_SCHEMA = [
  { key: 'fit', label: 'Fit', type: 'select', default: 'cover',
    options: [
      { value: 'cover',   label: 'Cover' },
      { value: 'contain', label: 'Contain' },
      { value: 'fill',    label: 'Fill' },
    ] },
  { key: 'playbackRate', label: 'Speed', type: 'range', min: 0.25, max: 4, step: 0.05, default: 1, section: 'Video', when: isVideo },
  /* Trim window — normalized fractions of clip duration. animatable:false:
   * these frame the loop window (structural), not a per-frame modulation
   * target — binding them would re-seek every tick. */
  { key: 'trimIn',  label: 'Trim in',  type: 'range', min: 0, max: 1, step: 0.01, default: 0, format: pct, animatable: false, section: 'Video', when: isVideo },
  { key: 'trimOut', label: 'Trim out', type: 'range', min: 0, max: 1, step: 0.01, default: 1, format: pct, animatable: false, section: 'Video', when: isVideo },
  { key: 'videoLoop',  label: 'Loop',  type: 'toggle', default: true, section: 'Video', when: isVideo },
  { key: 'videoMuted', label: 'Muted', type: 'toggle', default: true, section: 'Video', when: isVideo },
  /* Webcam-only. Horizontal flip of the live feed — the expected selfie-view
   * affordance (labs LiveEditor). Applied PRE-filter (on the source draw / the
   * DOM element), distinct from the generic layer flipX. Trim/loop/speed above
   * gate on isVideo, so they never surface for a webcam layer. */
  { key: 'mirror', label: 'Mirror', type: 'toggle', default: true, section: 'Camera', when: isWebcam },
]
