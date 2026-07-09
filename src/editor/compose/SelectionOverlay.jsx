import { useContext } from 'react'
import { CanvasZoomContext } from '../shell/Canvas'

/**
 * SelectionOverlay — chrome for the selected layer.
 *
 * Renders a dashed outline + 8 resize handles + dimension label, all
 * positioned in the same 1080-virtual coord space the layer lives in.
 * Each handle has a `data-handle` attribute so the canvas's pointer
 * router knows which resize mode to start.
 */
const HANDLE_SIZE = 10  /* virtual px */

/* Dimension-label backdrop — dark scrim over arbitrary canvas content (kol-theme
 * ships no scrim token yet). */
const LABEL_SCRIM = 'rgba(0,0,0,0.6)'

const HANDLE_DIRS = [
  { dir: 'NW', cursor: 'nwse-resize', x: 0,    y: 0    },
  { dir: 'N',  cursor: 'ns-resize',   x: 0.5,  y: 0    },
  { dir: 'NE', cursor: 'nesw-resize', x: 1,    y: 0    },
  { dir: 'E',  cursor: 'ew-resize',   x: 1,    y: 0.5  },
  { dir: 'SE', cursor: 'nwse-resize', x: 1,    y: 1    },
  { dir: 'S',  cursor: 'ns-resize',   x: 0.5,  y: 1    },
  { dir: 'SW', cursor: 'nesw-resize', x: 0,    y: 1    },
  { dir: 'W',  cursor: 'ew-resize',   x: 0,    y: 0.5  },
]

export default function SelectionOverlay({ layer, showHandles = true, showLabel = true, showRotate = showHandles }) {
  /* Chrome renders in virtual px inside the zoomed transform — divide by
   * zoom so handles/outline/label stay screen-constant at any zoom. */
  const zoom = useContext(CanvasZoomContext)

  if (!layer || layer.x == null) return null  /* cover-type layers have no chrome */

  const { x, y, w, h } = layer
  const handleSize = HANDLE_SIZE / zoom
  /* rotation may be a binding object (animated); chrome uses the base 0 —
   * editing chrome on animated props is a v1 limitation. */
  const rot = typeof layer.rotation === 'number' ? layer.rotation : 0

  return (
    <div
      style={{
        position: 'absolute',
        left: x, top: y,
        width: w, height: h,
        /* chrome rotates with the layer (center origin) so the wireframe
         * and handles hug the actual rendered box */
        transform: rot ? `rotate(${rot}deg)` : undefined,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0,
          outline: `${1 / zoom}px dashed var(--kol-accent-primary)`,
          outlineOffset: 0,
        }}
      />
      {/* rotate handle — circle floating above the top edge; drag rotates
        * the layer about its center (CanvasArea 'rotate' drag mode).
        * Independent of resize handles: paths hide those (node-edit owns
        * their geometry) but still rotate. */}
      {showRotate && (
        <div
          data-handle="ROT"
          title="Rotate (⇧ snaps 15°)"
          style={{
            position: 'absolute',
            left: `calc(50% - ${handleSize / 2}px)`,
            top: -(22 / zoom),
            width: handleSize,
            height: handleSize,
            borderRadius: '50%',
            background: 'white',
            border: `${1 / zoom}px solid var(--kol-accent-primary)`,
            cursor: 'grab',
            pointerEvents: 'auto',
          }}
        />
      )}
      {showHandles && HANDLE_DIRS.map(({ dir, cursor, x: hx, y: hy }) => (
        <div
          key={dir}
          data-handle={dir}
          style={{
            position: 'absolute',
            left:   `calc(${hx * 100}% - ${handleSize / 2}px)`,
            top:    `calc(${hy * 100}% - ${handleSize / 2}px)`,
            width:  handleSize,
            height: handleSize,
            background: 'white',
            border: `${1 / zoom}px solid var(--kol-accent-primary)`,
            cursor,
            pointerEvents: 'auto',
          }}
        />
      ))}
      {showLabel && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 6 / zoom,
            transform: `scale(${1 / zoom})`,
            transformOrigin: 'top left',
            fontFamily: 'var(--kol-font-family-mono)',
            fontSize: 10,
            letterSpacing: '0.04em',
            color: 'var(--kol-accent-primary)',
            background: LABEL_SCRIM,
            padding: '2px 6px',
            borderRadius: 2,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {Math.round(w)} × {Math.round(h)}
        </span>
      )}
    </div>
  )
}
