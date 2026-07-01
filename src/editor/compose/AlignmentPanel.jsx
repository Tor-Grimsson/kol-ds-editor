import EditorIcon from '../icons/EditorIcon'
import { useComposeState } from './state'

const ALIGN_BUTTONS = [
  { axis: 'h', mode: 'start',  icon: 'align-h-start',  title: 'Align left' },
  { axis: 'h', mode: 'center', icon: 'align-h-center', title: 'Align horizontal center' },
  { axis: 'h', mode: 'end',    icon: 'align-h-end',    title: 'Align right' },
  { axis: 'v', mode: 'start',  icon: 'align-v-start',  title: 'Align top' },
  { axis: 'v', mode: 'center', icon: 'align-v-center', title: 'Align vertical center' },
  { axis: 'v', mode: 'end',    icon: 'align-v-end',    title: 'Align bottom' },
]

/* AlignmentPanel — six-button alignment row for multi-layer selections.
 * Operates on the common bbox of the currently-selected layers. Lives in
 * the inspector rail's multi-layer branch (≥ 2 positioned layers). */
export default function AlignmentPanel() {
  const { alignSelected } = useComposeState()
  return (
    <div className="grid grid-cols-6 gap-1">
      {ALIGN_BUTTONS.map((b) => (
        <button
          key={`${b.axis}-${b.mode}`}
          type="button"
          onClick={() => alignSelected(b.axis, b.mode)}
          title={b.title}
          aria-label={b.title}
          className="kol-btn-quiet inline-flex items-center justify-center rounded text-emphasis"
          style={{ width: '100%', height: 28, padding: 6 }}
        >
          <EditorIcon name={b.icon} size={16} />
        </button>
      ))}
    </div>
  )
}
