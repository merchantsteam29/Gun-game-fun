// Weapon camos: looks only, never stats. A camo is stored per gun alongside its attachments
// (mods[id].camo), so it saves locally, syncs to other players and rebuilds models the same way.
// Add a camo by adding an entry here:
//   color            solid paint for the gun's body parts
//   pattern          'digital' | 'stripes' | 'splotch' | 'carbon' | 'stars' | 'cracks' drawn from `colors` (first = base)
//   price            tokens to unlock (Character → Customize → Weapon wraps); no price = free
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
  // Premium wraps (tokens)
  { id: 'carbon', name: 'Carbon Fiber', pattern: 'carbon', colors: ['#1a1c20', '#2e3238'], rough: 0.35, metal: 0.4, price: 150 },
  { id: 'zebra', name: 'Zebra', pattern: 'stripes', colors: ['#eceff2', '#141518'], price: 150 },
  { id: 'toxic', name: 'Toxic', pattern: 'splotch', colors: ['#1f2616', '#8fff4a', '#3aff7a', '#4d5a32'], glow: '#123d0a', price: 200 },
  { id: 'ice', name: 'Glacier', pattern: 'splotch', colors: ['#bfefff', '#e8f9ff', '#7fc8e8', '#d8c8ff'], metal: 0.5, rough: 0.2, price: 250 },
  { id: 'lava', name: 'Lava', pattern: 'cracks', colors: ['#1a0a06', '#ff5a12', '#ffb020'], glow: '#5a1400', price: 300 },
  { id: 'galaxy', name: 'Galaxy', pattern: 'stars', colors: ['#0a0618', '#7a3aff', '#ff3aa8', '#ffffff'], glow: '#14062e', price: 350 },
  { id: 'chrome', name: 'Chrome', color: '#e8edf3', metal: 1, rough: 0.08, price: 400 },
  { id: 'diamond', name: 'Diamond', pattern: 'stars', colors: ['#d8f4ff', '#9fd8ff', '#ffffff', '#c9a8ff'], metal: 0.7, rough: 0.1, glow: '#20384a', price: 600 },
];

export const CAMO_IDS = CAMOS.map((c) => c.id);
export const camoOf = (id) => CAMOS.find((c) => c.id === id) || CAMOS[0];

// CSS background for the little swatch in the loadout menu.
export function camoSwatch(c) {
  if (c.pattern === 'carbon') return `repeating-linear-gradient(45deg, ${c.colors[0]} 0 3px, ${c.colors[1]} 3px 6px)`;
  if (c.pattern === 'stars') return `radial-gradient(circle at 30% 30%, ${c.colors[3]} 0 1px, transparent 2px), radial-gradient(circle at 70% 60%, ${c.colors[3]} 0 1px, transparent 2px), linear-gradient(135deg, ${c.colors[0]}, ${c.colors[1]} 60%, ${c.colors[2]})`;
  if (c.pattern === 'cracks') return `linear-gradient(120deg, ${c.colors[0]} 0 40%, ${c.colors[1]} 42%, ${c.colors[0]} 44% 70%, ${c.colors[2]} 72%, ${c.colors[0]} 74%)`;
  if (c.pattern === 'stripes') return `repeating-linear-gradient(45deg, ${c.colors[0]} 0 5px, ${c.colors[1]} 5px 8px)`;
  if (c.pattern) return `conic-gradient(${c.colors[0]} 0 25%, ${c.colors[1]} 0 50%, ${c.colors[2]} 0 75%, ${c.colors[3] || c.colors[0]} 0)`;
  if (c.color) return c.color;
  return 'linear-gradient(135deg, #4a5058, #26292e)';
}
