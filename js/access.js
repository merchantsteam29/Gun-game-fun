import { TEAM_COLORS } from './host.js';

// Colorblind modes. Swaps the colors the game uses to tell sides apart (red / blue teams,
// infection zombies) and the health bar, for ones that stay easy to tell apart.
//  protan / deutan (red-green): orange vs blue, purple zombies, blue health bar
//  tritan (blue-yellow): red vs teal, pink zombies
export const CB_MODES = [
  { id: 'off', name: 'Off' },
  { id: 'protan', name: 'Protanopia', hint: 'red-weak' },
  { id: 'deutan', name: 'Deuteranopia', hint: 'green-weak' },
  { id: 'tritan', name: 'Tritanopia', hint: 'blue-weak' },
];
const PALETTES = {
  off: { 1: '#e5483b', 2: '#3d8fe0', zombie: '#6fbf3a' },
  protan: { 1: '#ff9a1f', 2: '#3d8fe0', zombie: '#b37bff' },
  deutan: { 1: '#ff9a1f', 2: '#3d8fe0', zombie: '#b37bff' },
  tritan: { 1: '#e5483b', 2: '#19c2b4', zombie: '#ff7ab8' },
};
export const pal = { zombie: PALETTES.off.zombie };

export function applyColorblind(mode) {
  const p = PALETTES[mode] || PALETTES.off;
  TEAM_COLORS[1] = p[1];
  TEAM_COLORS[2] = p[2];
  pal.zombie = p.zombie;
  document.body.dataset.cb = PALETTES[mode] ? mode : 'off';
}
