/* The app hierarchy over the flat loop registry GROUPS, labs-true:
 *
 *   METHOD > TYPE > CATEGORY > PRESET
 *
 * (documented in docs/documentation/01-hierarchy.md). This file carries the
 * GENERATIVE method's TYPES as pure data: type → registry group ids, in
 * labs sidebar order. The registry stayed flat as families were imported
 * one by one; this restores the levels without touching it.
 *
 * Multi-group types mirror labs' own internal groups: labs Loops =
 * Shape/Field/Pattern (editor: Simple/Field/Pattern Loops); labs 3D Scene
 * spans the primitive/ribbon/forms/environments sub-pages plus Abstract
 * (RD/MSTP), which the editor registered as its own group.
 *
 * NOT here by design: `optic` (labs parks those four generator pages under
 * EFFECTS > Pattern — see effectCategories.js/MenuTop) and `paratype`
 * (labs Type Lab section — parked below the Generative menu).
 */
export const GENERATIVE_TREE = [
  { label: 'Scanline',      groups: ['scanline'] },
  { label: 'Pattern',       groups: ['pattern'] },
  { label: 'Loops',         groups: ['shape', 'field', 'patternloop'] },
  { label: 'Math',          groups: ['math'] },
  { label: 'Penrose',       groups: ['penrose'] },
  { label: 'Drift',         groups: ['drift'] },
  { label: 'Gradients',     groups: ['gradients'] },
  { label: 'Soft Forms',    groups: ['softforms'] },
  { label: 'Soft Forms 3D', groups: ['softforms3d'] },
  /* `scene` is labs' Primitive sub-page; its registry label ('3D scene')
   * would read as a duplicate under this type. */
  { label: '3D Scene',      groups: ['scene', 'ribbon', 'forms', 'environment', 'abstract'],
    labels: { scene: 'Primitive' } },
]

/* The `misc` layer's tree — home of the oddball rule-driven generators that
 * are neither Generative types nor Effects. Para Type first (labs Type Lab);
 * Interfaces (labs Composition screens/elements) joins later. */
export const MISC_TREE = [
  { label: 'Para Type', groups: ['paratype'] },
]

/* The loop layer's picker tree = the Generative types only. Groups living
 * elsewhere (optic → EFFECTS > Pattern, paratype → the misc layer) resolve
 * to a read-only identity via LEGACY_GROUP_LABELS instead of appearing as
 * pickable generative types. */
export const PICKER_TREE = GENERATIVE_TREE

export const LEGACY_GROUP_LABELS = {
  optic:    'Pattern · Effects',
  paratype: 'Para Type · Misc',
}
