// Drift palettes — one set per family. Each entry is a `base` colour (the
// backdrop / sky / horizon, drawn where there's no material) plus a 5-stop
// `cols` ramp the field is shaded through (dark → light). Same shape across
// families so the engine can `toVec3`-map any of them.

export const PALETTES = {
  // Air — base is the SKY behind the clouds.
  air: [
    { value: 'overcast', label: 'Overcast', base: '#aeb9c4',
      cols: ['#5d6b78', '#7c8a98', '#9aa7b4', '#c4cdd6', '#eef2f6'] },
    { value: 'dusk', label: 'Dusk', base: '#2a1c3a',
      cols: ['#3a2350', '#7b3f6e', '#c75c6a', '#f08e5a', '#ffd9a0'] },
    { value: 'storm', label: 'Storm', base: '#161b24',
      cols: ['#1c2230', '#2f3a4c', '#566275', '#8a97a8', '#d2dae3'] },
    { value: 'dawn', label: 'Dawn', base: '#f6c9a0',
      cols: ['#caa0c0', '#e3a59a', '#f4b27e', '#ffd9a0', '#fff3df'] },
    { value: 'noir', label: 'Noir', base: '#0a0a0c',
      cols: ['#101014', '#33343a', '#5d5e66', '#9a9ba4', '#ededf2'] },
    { value: 'aurora', label: 'Aurora', base: '#02141c',
      cols: ['#063b3a', '#0e7a5f', '#37c98a', '#6fe0c4', '#b6a8ff'] },
  ],
  // Water — base is the SKY reflected at grazing angles; ramp = deep → shallow.
  water: [
    { value: 'ocean', label: 'Ocean', base: '#a7c7d8',
      cols: ['#0a2a43', '#0e4c6b', '#1f7a9c', '#56b8c9', '#cdeef0'] },
    { value: 'tropical', label: 'Tropical', base: '#c4eee6',
      cols: ['#04403f', '#0a7d70', '#1bb89a', '#5fe0c0', '#e8fff7'] },
    { value: 'lake', label: 'Lake', base: '#c7d3c4',
      cols: ['#1f3a36', '#2f5a4e', '#4f7e6c', '#86a892', '#dfe9d8'] },
    { value: 'pool', label: 'Pool', base: '#d2f0fb',
      cols: ['#0b5a8c', '#1488c4', '#3fb6e6', '#8fdcf5', '#f4ffff'] },
    { value: 'sunset', label: 'Sunset', base: '#ffb27a',
      cols: ['#2a2350', '#6e3a72', '#c75c6a', '#f0925a', '#ffe2b0'] },
    { value: 'ink', label: 'Ink', base: '#10161c',
      cols: ['#0b1116', '#1d2a33', '#3a5360', '#6f8c98', '#cfe2e8'] },
  ],
  // Cloth — base is the studio backdrop; ramp = fabric shadow → highlight.
  cloth: [
    { value: 'silk', label: 'Silk', base: '#1a1418',
      cols: ['#3a1f2e', '#7e3c54', '#c06684', '#e6a2b0', '#ffe3ec'] },
    { value: 'velvet', label: 'Velvet', base: '#140608',
      cols: ['#3a060e', '#7a0f1c', '#b62230', '#e0566a', '#ffb8bf'] },
    { value: 'emerald', label: 'Emerald', base: '#06120e',
      cols: ['#063425', '#0c6b46', '#1aa16a', '#56cf95', '#bff0d4'] },
    { value: 'royal', label: 'Royal', base: '#070a18',
      cols: ['#0e1c52', '#1f3a9c', '#3a5fd0', '#7e9bee', '#d4e0ff'] },
    { value: 'gold', label: 'Gold', base: '#161007',
      cols: ['#3a2606', '#7e5510', '#c08a22', '#e6bd56', '#fff0c0'] },
    { value: 'linen', label: 'Linen', base: '#161310',
      cols: ['#4a4036', '#6f6253', '#998a77', '#c4b8a4', '#f2ead9'] },
  ],
}

export const paletteBy = (family, v) => {
  const list = PALETTES[family] || PALETTES.air
  return list.find((p) => p.value === v) || list[0]
}
