import { store } from './util.js';

// Player options, saved in localStorage. Read `opts.x` anywhere; call setOpt() to change one.
const DEFAULTS = {
  fov: 75,            // world field of view (vertical, degrees)
  vmFov: 65,          // weapon/arms field of view
  sens: 1,            // mouse sensitivity
  adsSens: 0.8,       // multiplier while aiming down sights
  touchSens: 1,       // drag-to-look speed on touch screens
  invertY: false,
  aimToggle: false,   // right mouse toggles aim instead of hold
  volume: 1,
  crossColor: '#ffffff',
  crossSize: 1,
  crossDot: true,
  showFps: false,
  bobbing: 1,         // head and weapon bob amount
  btnScale: 1,        // touch button size
  btnOpacity: 1,      // touch button opacity
  layout: {},         // touch button positions: { action: { x, y, s } } in % of the screen
  uiMode: 'auto',     // auto | phone | tablet | desktop (applies after reload)
};

export const opts = { ...DEFAULTS, ...store.get('opts', {}) };
// Older versions saved sensitivity on its own.
if (store.get('opts', null) === null) opts.sens = store.get('sens', DEFAULTS.sens);

const listeners = new Set();
export function onOpts(fn) { listeners.add(fn); fn(opts); }

export function setOpt(key, value) {
  opts[key] = value;
  store.set('opts', opts);
  for (const fn of listeners) fn(opts, key);
}

export function resetOpts(keys = Object.keys(DEFAULTS)) {
  for (const k of keys) opts[k] = structuredCloneSafe(DEFAULTS[k]);
  store.set('opts', opts);
  for (const fn of listeners) fn(opts, null);
}

function structuredCloneSafe(v) { return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; }

export { DEFAULTS as OPT_DEFAULTS };
