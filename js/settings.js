import { store } from './util.js';

// Player options, saved in localStorage. Read `opts.x` anywhere; call setOpt() to change one.
const DEFAULTS = {
  fov: 75,            // world field of view (vertical, degrees)
  vmFov: 65,          // weapon/arms field of view
  sens: 1,            // mouse sensitivity
  adsSens: 0.8,       // multiplier while aiming down sights
  touchSens: 1,       // drag-to-look speed on touch screens
  invertY: false,
  aimAssist: true,        // touch screens only
  aimAssistStrength: 0.6,
  showChat: true,
  aimToggle: false,   // right mouse toggles aim instead of hold
  volume: 1,
  crossColor: '#ffffff',
  crossSize: 1,
  crossDot: true,
  showFps: false,
  blood: true,
  killcam: true,      // replay from your killer's view when you die        // off: hits and kills show grey sparks instead of blood
  autoRes: true,      // lower the resolution a little when frames drop (game.js)
  recordClips: false, // opt-in highlight clips (highlights.js); off by default since browsers show a recording icon
  minimap: true,
  // PC-only extras from the secret Showroom (js/showroom.js)
  renderScale: 1,
  ultraShadows: false,
  rgbCross: false,
  srBg: 'studio',
  hudScale: 1,
  bobbing: 1,         // head and weapon bob amount
  btnScale: 1,        // touch button size
  btnOpacity: 1,      // touch button opacity
  layout: {},         // touch button positions: { action: { x, y, s } } in % of the screen
  uiMode: 'auto',     // auto | phone | tablet | desktop (applies after reload)
  // Controller
  padSens: 1,         // look speed
  padInvertY: false,
  padDeadzone: 0.14,
  padAutoSprint: false, // sprint when the left stick is pushed all the way forward
  padCrouchToggle: true, // B toggles crouch (off = hold)
  padVibration: true,
  // Party voice chat
  voiceVolume: 1,
  voicePtt: false,    // push-to-talk: hold the voice key (binds.js)
  binds: null,        // key bindings: null = defaults (binds.js)
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
