// Weapon camos: looks only, never stats. A camo is stored per gun alongside its attachments
// (mods[id].camo), so it saves locally, syncs to other players and rebuilds models the same way.
// Add a camo by adding an entry here:
//   color            solid paint for the gun's body parts
//   pattern          'digital' | 'stripes' | 'splotch' drawn from `colors` (first = base)
//   metal / rough    material finish (optional)
//   glow             emissive color (optional)
// The black accents, steel, brass, lenses and sights always keep their own materials.

export const CAMOS = [
  { id: 'default', name: 'Default' },
  { id: 'red', name: 'Crimson', color: '#9c2320' },
  { id: 'blue', name: 'Cobalt', color: '#2a55b8' },
  { id: 'black', name: 'Blackout', color: '#141518', rough: 0.4 },
  { id: 'white', name: 'Arctic', color: '#d8dde2' },
  { id: 'gold', name: 'Gold', color: '#e2b33a', metal: 0.9, rough: 0.25 },
  { id: 'digital', name: 'Digital', pattern: 'digital', colors: ['#4d5a32', '#2f3a22', '#7a7d5a', '#1f2616'] },
  { id: 'urban', name: 'Urban Digital', pattern: 'digital', colors: ['#8d9399', '#5a616a', '#c4c9ce', '#363a40'] },
  { id: 'desert', name: 'Desert', pattern: 'splotch', colors: ['#b59a6a', '#8f7a55', '#d4c29a', '#6e5a3a'] },
  { id: 'tiger', name: 'Tiger', pattern: 'stripes', colors: ['#d9822b', '#141518'] },
  { id: 'neon', name: 'Neon', color: '#ff2fd8', glow: '#7a1066', rough: 0.35 },
];

export const CAMO_IDS = CAMOS.map((c) => c.id);
export const camoOf = (id) => CAMOS.find((c) => c.id === id) || CAMOS[0];

// CSS background for the little swatch in the loadout menu.
export function camoSwatch(c) {
  if (c.pattern === 'stripes') return `repeating-linear-gradient(45deg, ${c.colors[0]} 0 5px, ${c.colors[1]} 5px 8px)`;
  if (c.pattern) return `conic-gradient(${c.colors[0]} 0 25%, ${c.colors[1]} 0 50%, ${c.colors[2]} 0 75%, ${c.colors[3] || c.colors[0]} 0)`;
  if (c.color) return c.color;
  return 'linear-gradient(135deg, #4a5058, #26292e)';
}
