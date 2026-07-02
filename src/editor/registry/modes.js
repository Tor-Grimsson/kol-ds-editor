/**
 * Mode feature manifests — the color modes packaged as the first features
 * registered through the seam (plan.md Phase 1). Importing this module
 * populates the registry; the shell (Editor, MenuTop) reads it instead of
 * its own hardcoded lists.
 *
 * Registration order == provider nesting order (outermost first), preserving
 * the previous ToolProvider > Compose > Palette > Pattern > Type stack.
 */
import { registerFeature } from './features'

import { ComposeStateProvider } from '../compose/state'
import { PaletteStateProvider } from '../modes/palette/state'
import { PatternStateProvider } from '../modes/pattern/state'
import { TypeStateProvider }    from '../modes/type/state'

import Compose    from '../../pages/Compose'
import ComboLab   from '../modes/palette/ComboLab'
import PatternLab from '../modes/pattern/PatternLab'
import TypeLab    from '../modes/type/TypeLab'

registerFeature({ id: 'compose', title: 'Compose', Provider: ComposeStateProvider, Body: Compose })
registerFeature({ id: 'palette', title: 'Palette', Provider: PaletteStateProvider, Body: ComboLab })
registerFeature({ id: 'pattern', title: 'Pattern', Provider: PatternStateProvider, Body: PatternLab })
registerFeature({ id: 'type',    title: 'Type',    Provider: TypeStateProvider,    Body: TypeLab })
