import { store } from './util.js';
import { allStats, getStat, onStats, isOwned } from './missions.js';
import { MAP_ORDER } from './maps.js';
import { WEAPONS } from './weapons.js';
import { myRanked, DIVISIONS } from './ranked.js';

// Achievements: feats you unlock once and keep. They give a badge (no XP, no tokens); you can
// show up to 3 on your profile. Progress comes from your lifetime stats (missions.js), plus a few
// event stats: bestWave (Zombie Survival), brWins (Battle Royale), tourneyWins (Game Night
// tournament) and gnMatches (Game Night matches).

const st = (k) => () => allStats()[k] || 0;
const weaponsUsed = () => Object.entries(allStats()).filter(([k, v]) => k.startsWith('w_') && WEAPONS[k.slice(2)] && v > 0).length;
const holidayBanners = () => ['newyear', 'lunarny', 'holi', 'purim', 'nowruz', 'eidfitr', 'passover', 'easter', 'orthodoxeaster', 'vaisakhi', 'vesak', 'eidadha', 'roshhashanah', 'diwali', 'gurpurab', 'hanukkah', 'bodhi', 'christmas'].filter((id) => isOwned('banner', 'hol_' + id)).length;
const bestDivision = () => { const r = myRanked(); return r.played ? DIVISIONS.indexOf(DIVISIONS.reduce((d, x) => (r.best >= x.min ? x : d), DIVISIONS[0])) : 0; };

// tier: bronze / silver / gold / legend (just the badge's color)
export const ACHIEVEMENTS = [
  { id: 'centurion', name: 'Centurion', icon: '💀', tier: 'bronze', desc: 'Get 100 kills', have: st('kills'), goal: 100 },
  { id: 'thousand', name: 'Thousand Club', icon: '☠️', tier: 'gold', desc: 'Get 1,000 kills', have: st('kills'), goal: 1000 },
  { id: 'sharpshooter', name: 'Sharpshooter', icon: '🎯', tier: 'silver', desc: 'Get 100 headshot kills', have: st('headshots'), goal: 100 },
  { id: 'headhunter', name: 'Headhunter', icon: '🧠', tier: 'gold', desc: 'Get 500 headshot kills', have: st('headshots'), goal: 500 },
  { id: 'untouchable', name: 'Untouchable', icon: '🛡️', tier: 'gold', desc: 'Get a 15-kill streak', have: st('bestStreak'), goal: 15 },
  { id: 'triple', name: 'Triple Threat', icon: '3️⃣', tier: 'silver', desc: 'Get 10 triple kills', have: st('tripleKills'), goal: 10 },
  { id: 'skyhigh', name: 'Sky High', icon: '🪂', tier: 'silver', desc: 'Get 25 kills while in the air', have: st('airKills'), goal: 25 },
  { id: 'clutch', name: 'Comeback Kid', icon: '❤️‍🩹', tier: 'silver', desc: 'Get 25 kills on low health', have: st('clutchKills'), goal: 25 },
  { id: 'revenge', name: 'Payback', icon: '😤', tier: 'bronze', desc: 'Get 25 revenge kills', have: st('revenge'), goal: 25 },
  { id: 'silent', name: 'Silent Killer', icon: '🤫', tier: 'silver', desc: 'Get 50 kills with a suppressor', have: st('silentKills'), goal: 50 },
  { id: 'longshot', name: 'Long Shot', icon: '🔭', tier: 'silver', desc: 'Get 25 kills from 40 m or more', have: st('longKills'), goal: 25 },
  { id: 'blades', name: 'Blade Master', icon: '🔪', tier: 'silver', desc: 'Get 50 melee kills', have: st('melee'), goal: 50 },
  { id: 'demolition', name: 'Demolition', icon: '💥', tier: 'silver', desc: 'Get 100 explosive kills', have: st('explosive'), goal: 100 },
  { id: 'kaboom', name: 'Kaboom', icon: '🛢️', tier: 'bronze', desc: 'Get 3 kills with exploding barrels', have: st('w_barrel'), goal: 3 },
  { id: 'gunnut', name: 'Gun Nut', icon: '🔫', tier: 'gold', desc: 'Get a kill with 20 different weapons', have: weaponsUsed, goal: 20 },
  { id: 'winner', name: 'Winner', icon: '🏆', tier: 'bronze', desc: 'Win 10 matches', have: st('wins'), goal: 10 },
  { id: 'champion', name: 'Serial Winner', icon: '👑', tier: 'gold', desc: 'Win 100 matches', have: st('wins'), goal: 100 },
  { id: 'veteran', name: 'Veteran', icon: '🎖️', tier: 'silver', desc: 'Play 250 matches', have: st('matches'), goal: 250 },
  { id: 'globetrotter', name: 'Globetrotter', icon: '🗺️', tier: 'silver', desc: 'Play on every map', have: () => getStat('mapsPlayed'), goal: MAP_ORDER.length },
  { id: 'allrounder', name: 'All-Rounder', icon: '🎲', tier: 'silver', desc: 'Play 15 different modes', have: () => getStat('modesPlayed'), goal: 15 },
  { id: 'survivor', name: 'Survivor', icon: '🧍', tier: 'bronze', desc: 'Survive 10 rounds of Infection', have: st('survived'), goal: 10 },
  { id: 'waverider', name: 'Wave Rider', icon: '🧟', tier: 'gold', desc: 'Survive 10 waves in Zombie Survival', have: st('bestWave'), goal: 10 },
  { id: 'lastone', name: 'Last One Standing', icon: '⚔️', tier: 'gold', desc: 'Win a Game Night Battle Royale', have: st('brWins'), goal: 1 },
  { id: 'tourney', name: 'Champion of the Night', icon: '🏅', tier: 'legend', desc: 'Win a Game Night tournament', have: st('tourneyWins'), goal: 1 },
  { id: 'nightowl', name: 'Night Owl', icon: '🌙', tier: 'bronze', desc: 'Play 10 matches in a Game Night server', have: st('gnMatches'), goal: 10 },
  { id: 'festive', name: 'Festive', icon: '🎉', tier: 'bronze', desc: 'Earn 3 holiday banners', have: holidayBanners, goal: 3 },
  { id: 'elite', name: 'Elite', icon: '✦', tier: 'gold', desc: 'Reach Elite in ranked', have: bestDivision, goal: DIVISIONS.findIndex((d) => d.id === 'elite') },
  { id: 'legend', name: 'Legend', icon: '♛', tier: 'legend', desc: 'Reach Legend in ranked', have: bestDivision, goal: DIVISIONS.findIndex((d) => d.id === 'legend') },
];
export const ACH = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const TIER_COLOR = { bronze: '#cd8b52', silver: '#c8d0d8', gold: '#ffcf4a', legend: '#ff5ad2' };

class Achievements {
  constructor() {
    this.unlocked = store.get('ach', {}); // id -> time unlocked
    this.listeners = [];
  }
  onUnlock(fn) { this.listeners.push(fn); }
  progress(a) { const have = Math.max(0, Number(a.have()) || 0); return { have: Math.min(have, a.goal), goal: a.goal, done: !!this.unlocked[a.id] }; }
  count() { return Object.keys(this.unlocked).filter((id) => ACH[id]).length; }
  // Unlocks anything newly reached (called after stats change).
  check() {
    const fresh = [];
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked[a.id]) continue;
      let have = 0;
      try { have = Number(a.have()) || 0; } catch { /* stat not ready */ }
      if (have >= a.goal) { this.unlocked[a.id] = Date.now(); fresh.push(a); }
    }
    if (fresh.length) {
      store.set('ach', this.unlocked);
      for (const a of fresh) for (const fn of this.listeners) fn(a);
    }
    return fresh;
  }
  // Up to 3 unlocked achievements to show on your profile.
  showcase() { return store.get('achShow', []).filter((id) => this.unlocked[id]).slice(0, 3); }
  toggleShow(id) {
    let s = this.showcase();
    if (s.includes(id)) s = s.filter((x) => x !== id);
    else if (this.unlocked[id]) { s.push(id); if (s.length > 3) s.shift(); }
    store.set('achShow', s);
    return s;
  }
}

export const achievements = new Achievements();
onStats(() => achievements.check());
