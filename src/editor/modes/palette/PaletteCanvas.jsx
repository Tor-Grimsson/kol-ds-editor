import Canvas from '../../shell/Canvas'
import { LAYOUT_COMPONENTS } from './layouts'
import { usePaletteState } from './state'
import { useComposeState } from '../../compose/state'

/**
 * PaletteCanvas — canvas content for Palette mode. Renders the active
 * layout component with the live displayPalette + logo.
 */
export default function PaletteCanvas() {
  const { aspect, palette, bgOn, colors } = useComposeState()
  const { layoutId, logo } = usePaletteState()
  const LayoutComponent = LAYOUT_COMPONENTS[layoutId]
  const bgColor = bgOn ? (colors[5] ?? undefined) : undefined

  return (
    <Canvas aspect={aspect} bgColor={bgColor} panEnabled>
      <div
        key={`${layoutId}-${colors.join('')}`}
        className="kol-combo-stage-anim w-full h-full self-stretch p-8"
      >
        {LayoutComponent ? <LayoutComponent palette={palette} logo={logo} /> : null}
      </div>
    </Canvas>
  )
}
