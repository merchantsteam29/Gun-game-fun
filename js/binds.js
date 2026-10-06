import { opts, setOpt, onOpts } from './settings.js';

// Key bindings for keyboard & mouse. Each action has up to two keys (KeyboardEvent.code, or
// 'Mouse1' middle / 'Mouse3' / 'Mouse4' side buttons). Fire and aim stay on the left / right
// mouse buttons. Controllers and touch buttons press actions directly ('@jump' etc. in
// game.keys), so rebinding the keyboard never affects them.
//
// Add an action by adding a row here and checking it with game.down('<id>') or onAction.

export const ACTIONS = [
  ['forward', 'Move forward', ['KeyW', 'ArrowUp']],
  ['back', 'Move back', ['KeyS', 'ArrowDown']],
  ['left', 'Move left', ['KeyA', 'ArrowLeft']],
  ['right', 'Move right', ['KeyD', 'ArrowRight']],
  ['jump', 'Jump', ['Space']],
  ['crouch', 'Crouch / slide', ['ControlLeft', 'KeyC']],
  ['sprint', 'Sprint', ['ShiftLeft']],
  ['reload', 'Reload', ['KeyR']],
  ['swap', 'Last weapon', ['KeyQ']],
  ['slot1', 'Primary', ['Digit1']],
  ['slot2', 'Secondary', ['Digit2']],
  ['slot3', 'Melee weapon', ['Digit3']],
  ['slot4', 'Utility', ['Digit4']],
  ['grenade', 'Quick grenade', ['KeyG']],
  ['melee', 'Quick melee', ['KeyF']],
  ['inspect', 'Inspect weapon', ['KeyT']],
  ['scores', 'Scoreboard', ['Tab']],
  ['chat', 'Chat', ['Enter']],
  ['voice', 'Push to talk (party voice)', ['KeyV']],
];

export const DEFAULT_BINDS = Object.fromEntries(ACTIONS.map(([id, , keys]) => [id, keys.slice()]));

// Current bindings (saved ones over the defaults; new actions get their defaults). Cached:
// the game asks every frame.
let cache = null;
onOpts(() => { cache = null; });
export function binds() {
  if (cache) return cache;
  const saved = opts.binds && typeof opts.binds === 'object' ? opts.binds : {};
  cache = {};
  for (const [id] of ACTIONS) cache[id] = Array.isArray(saved[id]) ? saved[id].slice(0, 2) : DEFAULT_BINDS[id].slice();
  return cache;
}

// Is this key / button bound to the action?
export function isBound(action, code) {
  return !!code && binds()[action].includes(code);
}

// The first action a key is bound to (for one-press actions like reload).
export function actionOf(code) {
  const b = binds();
  for (const [id] of ACTIONS) if (b[id].includes(code)) return id;
  return null;
}

// Binds `code` as key #`slot` (0 or 1) of `action`; a key can only do one thing, so it's
// taken off any other action first. code null clears the slot.
export function setBind(action, slot, code) {
  const b = JSON.parse(JSON.stringify(binds()));
  if (code) for (const [id] of ACTIONS) b[id] = b[id].map((c) => (c === code ? null : c));
  const keys = [b[action][0] || null, b[action][1] || null];
  keys[slot] = code;
  b[action] = keys.filter(Boolean);
  for (const [id] of ACTIONS) b[id] = b[id].filter(Boolean);
  setOpt('binds', b);
}

export function resetBinds() { setOpt('binds', null); }

const NAMES = {
  Space: 'Space', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
  AltLeft: 'L Alt', AltRight: 'R Alt', Tab: 'Tab', Enter: 'Enter', Backquote: '`', CapsLock: 'Caps',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Mouse1: 'Middle mouse', Mouse3: 'Mouse 4', Mouse4: 'Mouse 5',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
};

export function keyName(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

// Short label for help text: "W", "Space / C", …
export const keysLabel = (action) => binds()[action].map(keyName).join(' / ') || 'unbound';

// Mouse buttons that can be bound (left and right stay fire / aim).
export const mouseCode = (button) => ({ 1: 'Mouse1', 3: 'Mouse3', 4: 'Mouse4' })[button] || null;
