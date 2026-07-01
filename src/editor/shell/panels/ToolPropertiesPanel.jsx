import InspectorRail from '../../compose/InspectorRail'

/**
 * ToolPropertiesPanel — right.body (below Palette). Selection-driven
 * editor; content swaps by mode. In Compose mode this is the layer /
 * frame-slot inspector via InspectorRail.
 */
export default function ToolPropertiesPanel() {
  return <InspectorRail />
}
