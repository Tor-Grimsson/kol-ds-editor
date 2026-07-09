import { LabeledControl } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import RuleRow from '../../modes/pattern/RuleRow'
import { newRule, randomRule } from '../../../loops/pattern/rules.js'
import { mulberry32 } from '../../lib/rng'

/**
 * RulesEditor — the rule-stack editor for pattern-rules LOOP layers (labs
 * PatternControls.jsx:471-481 Rules section). The engine (loops/pattern/
 * rules.js) already composes `layer.rules` per cell; this gives the array a
 * UI: list (RuleRow, shared with PatternPanel's type:'pattern' surface), add,
 * remove, per-rule reroll (the labs dice — a fresh random rule keeping the
 * row's id), and Randomize (labs randomizeRules — 1-3 fresh random rules).
 *
 * Rolls are SEEDED through the Generate tab's shared seed (rolls.jsx
 * useRollSeed → mulberry32): a typed seed reproduces the next roll, and the
 * seed that produced a roll persists on the layer as `_rollSeed` — same
 * contract as computeRoll. Every action lands as ONE `patch` (useLayerEdit
 * coalesced history) ⇒ one undo step.
 *
 * Mounted by ParametersPanel's LoopFields (Generate tab) for
 * loopId:'pattern-rules' layers whose render kind is 'tiles' — the fields /
 * weave renders bypass the rule engine entirely.
 */
export default function RulesEditor({ layer, patch, seed }) {
  const rules = layer.rules ?? []
  const setRules = (next, extra) => patch({ rules: next, ...extra })

  const addRule = () => setRules([...rules, newRule()])
  const updateRule = (i, updated) => setRules(rules.map((r, k) => (k === i ? updated : r)))
  const removeRule = (i) => setRules(rules.filter((_, k) => k !== i))
  const rerollRule = (i) => {
    const s = seed.take()
    const rng = mulberry32(s >>> 0)
    setRules(rules.map((r, k) => (k === i ? { ...randomRule(rng), id: r.id } : r)), { _rollSeed: s })
  }
  const randomizeRules = () => {
    const s = seed.take()
    const rng = mulberry32(s >>> 0)
    const count = 1 + Math.floor(rng() * 3)
    setRules(Array.from({ length: count }, () => randomRule(rng)), { _rollSeed: s })
  }

  return (
    <LabeledControl label={`Rules · ${rules.length}`}>
      <div className="flex flex-col gap-2">
        {rules.map((rule, i) => (
          <RuleRow
            key={rule.id ?? i}
            rule={rule}
            onChange={(updated) => updateRule(i, updated)}
            onRemove={() => removeRule(i)}
            onReroll={() => rerollRule(i)}
          />
        ))}
        <div className="grid grid-cols-2 gap-2">
          <EditorButton variant="primary" size="sm" iconLeft="plus" onClick={addRule}>
            Add rule
          </EditorButton>
          <EditorButton variant="primary" size="sm" onClick={randomizeRules}>
            Randomize
          </EditorButton>
        </div>
      </div>
    </LabeledControl>
  )
}
