export const ASPECTS = [
  { id: '1:1',    label: '1:1',    ratio: 1     },
  { id: '4:5',    label: '4:5',    ratio: 4 / 5 },
  { id: '3:5',    label: '3:5',    ratio: 3 / 5 },
  { id: '9:16',   label: '9:16',   ratio: 9 / 16 },
  { id: '5:4',    label: '5:4',    ratio: 5 / 4 },
  { id: '5:3',    label: '5:3',    ratio: 5 / 3 },
  { id: '16:9',   label: '16:9',   ratio: 16 / 9 },
  { id: 'custom', label: 'Custom', ratio: 1     },
]

/* Pixel dimensions each preset resolves to. Picking a preset sets the
 * canvas's real W×H (drives export resolution + frame ratio); 'custom'
 * has no entry — its dimensions come from the user's W/H fields. Short
 * side pinned to 1080 (the working/export baseline). */
export const PRESET_SIZES = {
  '1:1':  { w: 1080, h: 1080 },
  '4:5':  { w: 1080, h: 1350 },
  '3:5':  { w: 1080, h: 1800 },
  '9:16': { w: 1080, h: 1920 },
  '5:4':  { w: 1350, h: 1080 },
  '5:3':  { w: 1800, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
}
