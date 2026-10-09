// Game Night events: when they happen and when to warn about them.
// Everyone works the times out from the same owner-signed Game Night schedule, so every player
// gets the same warnings and the Game Night server's host starts the round on time.
//  - Battle Royale: every 30 minutes into Game Night (warned 15 minutes before). None in the
//    last 30 minutes, which are kept for the tournament.

const MIN = 60000;
export const BR_EVERY = 30; // minutes
export const BR_WARN = 15; // minutes of warning
export const BR_LENGTH = 8; // minutes (the round's time limit)
export const TOURNEY_LENGTH = 30; // the last 30 minutes of Game Night

// Events in a Game Night window { start, end }: [{ kind, at, warn (minutes) }], in order.
export function gnEvents(w) {
  if (!w) return [];
  const out = [];
  const tourney = w.end - TOURNEY_LENGTH * MIN;
  for (let t = w.start + BR_EVERY * MIN; t + BR_LENGTH * MIN <= tourney; t += BR_EVERY * MIN) out.push({ kind: 'br', at: t, warn: BR_WARN });
  return out;
}

export const EVENT_NAMES = { br: '⚔ Battle Royale' };

// The next event that hasn't started yet (or null).
export function nextEvent(w, now = Date.now()) {
  return gnEvents(w).find((e) => e.at > now) || null;
}

// Calls fn({ kind, at, step }) once per step: 'warn' (at the warning time), 'soon' (1 minute
// before) and 'go' (start). Checks every few seconds; a step that was missed by more than a
// minute (the game wasn't open) is skipped.
export function watchEvents(getWindow, fn) {
  const done = new Set();
  const check = () => {
    const now = Date.now();
    for (const e of gnEvents(getWindow())) {
      const steps = [['warn', e.at - e.warn * MIN], ['soon', e.at - MIN], ['go', e.at]];
      for (const [step, t] of steps) {
        const key = e.kind + e.at + step;
        if (done.has(key) || now < t) continue;
        done.add(key);
        if (now - t < MIN) fn({ ...e, step });
      }
    }
  };
  setInterval(check, 5000);
  check();
}
