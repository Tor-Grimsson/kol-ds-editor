import Canvas from '../../shell/Canvas'
import { usePatternState } from './state'

/**
 * PatternCanvas — canvas content for Pattern mode. Renders the live SVG
 * preview of the tile.
 */
export default function PatternCanvas() {
  const { svgString, overflow } = usePatternState()
  return (
    <Canvas aspect="1:1" panEnabled>
      <div
        className={`w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full ${overflow ? '[&>svg]:overflow-visible' : ''}`}
        dangerouslySetInnerHTML={{ __html: svgString }}
      />
    </Canvas>
  )
}
