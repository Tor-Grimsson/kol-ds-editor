import { Section } from '@kolkrabbi/kol-component'
import { Dropdown } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import { Input } from '@kolkrabbi/kol-component'
import { Slider } from '@kolkrabbi/kol-component'
import { Stepper } from '@kolkrabbi/kol-component'

/**
 * Pattern rule row — per-cell selector + transforms for one rule. Used by
 * Pattern Lab's inspector and (Phase 6f) compose's PatternFields.
 *
 * Rule shape (mirrors `pattern-lab/render.js` consumer):
 *   { id, selectKind, n, offset, n2, offset2, expression,
 *     groupW, groupH, rotate, flipH, flipV, hide, opacity }
 *
 * Helper exports (`newRule`, `randomRule`, `SELECT_OPTIONS`, `ROTATE_OPTIONS`)
 * let consumers build + randomize rule arrays without re-implementing.
 */

export const SELECT_OPTIONS = [
  { value: 'all',        label: 'All cells' },
  { value: 'every-col',  label: 'Every Nth col' },
  { value: 'every-row',  label: 'Every Nth row' },
  { value: 'both',       label: 'Nth col × Nth row' },
  { value: 'every-nth',  label: 'Every Nth (flat)' },
  { value: 'checker',    label: 'Checker' },
  { value: 'expression', label: 'Expression…' },
]

export const ROTATE_OPTIONS = [
  { value: 0,   label: '0°' },
  { value: 90,  label: '90°' },
  { value: 180, label: '180°' },
  { value: 270, label: '270°' },
]

const RANDOM_KINDS   = ['every-col', 'every-row', 'both', 'every-nth', 'checker']
const RANDOM_ROTATES = [0, 90, 180, 270]

let nextRuleId = 1
const ruleId = () => `r${nextRuleId++}`

export const newRule = () => ({
  id:         ruleId(),
  selectKind: 'every-col',
  n:          2,
  offset:     0,
  n2:         2,
  offset2:    0,
  expression: 'sin(col * 0.6) + cos(row * 0.6)',
  groupW:     1,
  groupH:     1,
  rotate:     90,
  flipH:      false,
  flipV:      false,
  hide:       false,
  opacity:    1,
})

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export const randomRule = () => ({
  id:         ruleId(),
  selectKind: pick(RANDOM_KINDS),
  n:          Math.floor(Math.random() * 5) + 2,
  offset:     Math.floor(Math.random() * 3),
  n2:         Math.floor(Math.random() * 5) + 2,
  offset2:    Math.floor(Math.random() * 3),
  expression: 'sin(col * 0.6) + cos(row * 0.6)',
  groupW:     Math.random() > 0.6 ? Math.floor(Math.random() * 3) + 1 : 1,
  groupH:     Math.random() > 0.6 ? Math.floor(Math.random() * 3) + 1 : 1,
  rotate:     pick(RANDOM_ROTATES),
  flipH:      Math.random() > 0.6,
  flipV:      Math.random() > 0.6,
  hide:       Math.random() > 0.85,
  opacity:    Math.random() > 0.7 ? 0.4 + Math.random() * 0.6 : 1,
})

function NumInput({ value, onChange, min = 0, max = 99 }) {
  return (
    <Stepper
      size="sm"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full"
    />
  )
}

function ToggleChip({ active, onClick, children, title }) {
  return (
    <EditorButton
      variant={active ? 'primary' : 'outline'}
      size="sm"
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </EditorButton>
  )
}

export default function RuleRow({ rule, onChange, onRemove, onReroll }) {
  const set = (patch) => onChange({ ...rule, ...patch })
  const showN    = rule.selectKind === 'every-col' || rule.selectKind === 'every-row' || rule.selectKind === 'every-nth' || rule.selectKind === 'both'
  const showN2   = rule.selectKind === 'both'
  const showExpr = rule.selectKind === 'expression'

  return (
    <div className="flex flex-col gap-2 p-2 border border-fg-08 rounded">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <Dropdown
            variant="subtle"
            size="sm"
            className="w-full"
            options={SELECT_OPTIONS}
            value={rule.selectKind}
            onChange={(v) => set({ selectKind: v })}
          />
        </div>
        <EditorButton
          variant="ghost"
          size="sm"
          iconOnly="refresh"
          iconSize={12}
          onClick={onReroll}
          aria-label="Re-randomize rule"
          title="Re-randomize this rule"
          className="shrink-0"
          style={{ padding: 6 }}
        />
        <EditorButton
          variant="ghost"
          size="sm"
          iconOnly="close"
          iconSize={12}
          onClick={onRemove}
          aria-label="Remove rule"
          className="shrink-0"
          style={{ padding: 6 }}
        />
      </div>

      {showN && (
        <div className="grid grid-cols-2 gap-2">
          <Section label="N">
            <NumInput value={rule.n} onChange={(v) => set({ n: v })} min={1} />
          </Section>
          <Section label="Offset">
            <NumInput value={rule.offset} onChange={(v) => set({ offset: v })} />
          </Section>
        </div>
      )}

      {showN2 && (
        <div className="grid grid-cols-2 gap-2">
          <Section label="Row N">
            <NumInput value={rule.n2} onChange={(v) => set({ n2: v })} min={1} />
          </Section>
          <Section label="Row offset">
            <NumInput value={rule.offset2} onChange={(v) => set({ offset2: v })} />
          </Section>
        </div>
      )}

      {showExpr && (
        <Section label="Expression" hint="matches when > 0">
          <Input
            variant="filled"
            size="sm"
            value={rule.expression}
            onChange={(e) => set({ expression: e.target.value })}
            placeholder="sin(col * 0.6) + cos(row * 0.6)"
          />
          <span className="kol-helper-10 text-subtle mt-1">vars: i, col, row, cols, rows · Math.* in scope</span>
        </Section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Section label="Group W">
          <NumInput value={rule.groupW} onChange={(v) => set({ groupW: Math.max(1, v) })} min={1} />
        </Section>
        <Section label="Group H">
          <NumInput value={rule.groupH} onChange={(v) => set({ groupH: Math.max(1, v) })} min={1} />
        </Section>
      </div>

      <div className="flex flex-wrap gap-1">
        <Dropdown
          variant="subtle"
          size="sm"
          options={ROTATE_OPTIONS}
          value={rule.rotate}
          onChange={(v) => set({ rotate: Number(v) })}
        />
        <ToggleChip active={rule.flipH} onClick={() => set({ flipH: !rule.flipH })} title="Flip horizontal">
          ⇋
        </ToggleChip>
        <ToggleChip active={rule.flipV} onClick={() => set({ flipV: !rule.flipV })} title="Flip vertical">
          ⇵
        </ToggleChip>
        <ToggleChip active={rule.hide} onClick={() => set({ hide: !rule.hide })} title="Hide cell">
          hide
        </ToggleChip>
      </div>

      <Section label="Opacity" hint={`${Math.round(rule.opacity * 100)}%`}>
        <Slider
          min={0}
          max={100}
          value={Math.round(rule.opacity * 100)}
          onChange={(v) => set({ opacity: v / 100 })}
        />
      </Section>
    </div>
  )
}
