// Holiday events: major holidays of many faiths and cultures. While one is on, the home screen
// says so, XP is boosted a little, and finishing a match earns that holiday's banner (once a year)
// plus some tokens. Holidays that follow a lunar or lunisolar calendar come from a table (they can
// be a day off where you live, depending on local custom and moon sighting); the rest are worked out.

export const HOLIDAY_XP = 1.25;
export const HOLIDAY_TOKENS = 150;

// [first day, number of days] by year; 'MM-DD'
const T = (dates, len) => (y) => (dates[y] ? [dates[y], len] : null);
const fixed = (md, len) => () => [md, len];

// Western Easter (Gregorian computus).
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day);
}
// Orthodox Easter (Julian computus, moved to the Gregorian calendar: +13 days in 1900–2099).
function orthodoxEaster(y) {
  const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day) + 13 * 86400000;
}
const md = (t) => new Date(t).toISOString().slice(5, 10);

export const HOLIDAYS = [
  { id: 'newyear', name: "New Year's", who: 'Everyone', icon: '🎆', greet: 'Happy New Year!', when: fixed('12-31', 2),
    banner: { bg: 'radial-gradient(circle at 20% 40%, #ffd34a 0 3%, transparent 4%), radial-gradient(circle at 70% 30%, #ff5fd2 0 3%, transparent 4%), radial-gradient(circle at 45% 70%, #5fd8ff 0 3%, transparent 4%), linear-gradient(100deg, #070b24, #1b1650)', accent: '#ffd34a', emblem: '🎆', anim: 'twinkle' } },
  { id: 'lunarny', name: 'Lunar New Year', who: 'Chinese, Korean, Vietnamese and other traditions', icon: '🧧', greet: 'Happy Lunar New Year!',
    when: T({ 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03' }, 3),
    banner: { bg: 'radial-gradient(circle at 85% 50%, #ffd34a55 0 18%, transparent 40%), linear-gradient(100deg, #5a0006, #b3121b 60%, #e0301e)', accent: '#ffd34a', emblem: '🧧' } },
  { id: 'holi', name: 'Holi', who: 'Hindu', icon: '🎨', greet: 'Happy Holi!',
    when: T({ 2026: '03-04', 2027: '03-22', 2028: '03-11', 2029: '03-01', 2030: '03-20' }, 2),
    banner: { bg: 'radial-gradient(circle at 15% 40%, #ff3fa4 0 16%, transparent 30%), radial-gradient(circle at 45% 70%, #ffd23f 0 16%, transparent 32%), radial-gradient(circle at 75% 35%, #3fd0ff 0 16%, transparent 32%), radial-gradient(circle at 92% 75%, #7cff4f 0 12%, transparent 26%), #6a2aa8', accent: '#ffffff', emblem: '🎨' } },
  { id: 'purim', name: 'Purim', who: 'Jewish', icon: '🎭', greet: 'Happy Purim!',
    when: T({ 2026: '03-03', 2027: '03-23', 2028: '03-12', 2029: '03-01', 2030: '03-19' }, 1),
    banner: { bg: 'repeating-linear-gradient(135deg, #3a1a66 0 12px, #4a2480 12px 24px)', accent: '#ffcf4a', emblem: '🎭' } },
  { id: 'nowruz', name: 'Nowruz', who: 'Persian new year, also Baháʼí Naw-Rúz', icon: '🌱', greet: 'Happy Nowruz!', when: fixed('03-20', 3),
    banner: { bg: 'radial-gradient(ellipse at 50% 130%, #7cd957 0 35%, transparent 36%), linear-gradient(180deg, #bfe8ff, #7fc8f0)', accent: '#2f8f2f', emblem: '🌱', dark: true } },
  { id: 'eidfitr', name: 'Eid al-Fitr', who: 'Muslim', icon: '🌙', greet: 'Eid Mubarak!',
    when: T({ 2026: '03-20', 2027: '03-10', 2028: '02-27', 2029: '02-15', 2030: '02-05' }, 3),
    banner: { bg: 'radial-gradient(circle at 78% 40%, #ffe9a8 0 12%, transparent 13%), radial-gradient(circle at 82% 36%, #0d2a3a 0 11%, transparent 12%), linear-gradient(100deg, #06202c, #0d4a5a)', accent: '#ffe9a8', emblem: '🌙' } },
  { id: 'passover', name: 'Passover', who: 'Jewish', icon: '🍷', greet: 'Chag Pesach Sameach!',
    when: T({ 2026: '04-02', 2027: '04-22', 2028: '04-11', 2029: '03-31', 2030: '04-18' }, 8),
    banner: { bg: 'linear-gradient(100deg, #2a0d1a, #6a1a3a 55%, #a8325a)', accent: '#f2d7a0', emblem: '🍷' } },
  { id: 'easter', name: 'Easter', who: 'Christian', icon: '🐣', greet: 'Happy Easter!', when: (y) => [md(easter(y) - 86400000), 3],
    banner: { bg: 'radial-gradient(circle at 20% 50%, #ffd9f2 0 10%, transparent 11%), radial-gradient(circle at 50% 30%, #d9f2ff 0 9%, transparent 10%), radial-gradient(circle at 80% 60%, #fff2b3 0 10%, transparent 11%), linear-gradient(100deg, #b9e8a8, #8fd18a)', accent: '#7a4bc2', emblem: '🐣', dark: true } },
  { id: 'orthodoxeaster', name: 'Orthodox Easter', who: 'Orthodox Christian', icon: '🥚', greet: 'Christ is risen! Happy Pascha!',
    when: (y) => (orthodoxEaster(y) === easter(y) ? null : [md(orthodoxEaster(y) - 86400000), 3]),
    banner: { bg: 'repeating-linear-gradient(90deg, #8a1010 0 10px, #b3201b 10px 20px), #8a1010', accent: '#ffd34a', emblem: '🥚' } },
  { id: 'vaisakhi', name: 'Vaisakhi', who: 'Sikh, also the Hindu harvest festival', icon: '🌾', greet: 'Happy Vaisakhi!', when: fixed('04-13', 2),
    banner: { bg: 'radial-gradient(ellipse at 50% 140%, #e8b42a 0 45%, transparent 46%), linear-gradient(180deg, #ff9a2a, #ffcf5a)', accent: '#1f3a8a', emblem: '🌾', dark: true } },
  { id: 'vesak', name: 'Vesak', who: 'Buddhist', icon: '🪷', greet: 'Happy Vesak!',
    when: T({ 2026: '05-01', 2027: '05-20', 2028: '05-08', 2029: '05-27', 2030: '05-16' }, 2),
    banner: { bg: 'radial-gradient(circle at 80% 30%, #fff6c2 0 9%, transparent 10%), linear-gradient(100deg, #1a1440, #3a2a7a 60%, #e88ac0)', accent: '#ffd6ec', emblem: '🪷' } },
  { id: 'eidadha', name: 'Eid al-Adha', who: 'Muslim', icon: '🕌', greet: 'Eid Mubarak!',
    when: T({ 2026: '05-27', 2027: '05-16', 2028: '05-05', 2029: '04-24', 2030: '04-13' }, 3),
    banner: { bg: 'repeating-linear-gradient(60deg, #0f5a3a 0 10px, #127046 10px 20px), #0f5a3a', accent: '#f2d27a', emblem: '🕌' } },
  { id: 'roshhashanah', name: 'Rosh Hashanah', who: 'Jewish new year', icon: '🍎', greet: 'Shanah Tovah!',
    when: T({ 2026: '09-12', 2027: '10-02', 2028: '09-21', 2029: '09-10', 2030: '09-28' }, 2),
    banner: { bg: 'radial-gradient(circle at 80% 50%, #ffcf4a55 0 18%, transparent 40%), linear-gradient(100deg, #3a0a0a, #a8201a)', accent: '#ffcf4a', emblem: '🍎' } },
  { id: 'diwali', name: 'Diwali', who: 'Hindu, Sikh and Jain', icon: '🪔', greet: 'Happy Diwali!',
    when: T({ 2026: '11-07', 2027: '10-28', 2028: '10-16', 2029: '11-04', 2030: '10-25' }, 3),
    banner: { bg: 'radial-gradient(circle at 15% 70%, #ffb020 0 4%, transparent 9%), radial-gradient(circle at 40% 60%, #ffcf4a 0 4%, transparent 9%), radial-gradient(circle at 65% 70%, #ffb020 0 4%, transparent 9%), radial-gradient(circle at 90% 60%, #ffcf4a 0 4%, transparent 9%), linear-gradient(100deg, #2a0a3a, #5a1a5a)', accent: '#ffcf4a', emblem: '🪔', anim: 'flicker' } },
  { id: 'gurpurab', name: 'Guru Nanak Gurpurab', who: 'Sikh', icon: '🪯', greet: 'Happy Gurpurab!',
    when: T({ 2026: '11-24', 2027: '11-14', 2028: '11-02', 2029: '11-21', 2030: '11-10' }, 2),
    banner: { bg: 'linear-gradient(100deg, #0d1f4a, #1f3a8a 60%, #ff9a2a)', accent: '#ffcf4a', emblem: '🪯' } },
  { id: 'hanukkah', name: 'Hanukkah', who: 'Jewish', icon: '🕎', greet: 'Happy Hanukkah!',
    when: T({ 2026: '12-05', 2027: '12-25', 2028: '12-13', 2029: '12-02', 2030: '12-21' }, 8),
    banner: { bg: 'radial-gradient(circle at 50% 20%, #ffd34a55 0 14%, transparent 34%), repeating-linear-gradient(90deg, #0d2a6a 0 16px, #12348a 16px 32px)', accent: '#e8eef8', emblem: '🕎' } },
  { id: 'bodhi', name: 'Bodhi Day', who: 'Buddhist', icon: '🌳', greet: 'Happy Bodhi Day!', when: fixed('12-08', 1),
    banner: { bg: 'radial-gradient(ellipse at 50% 120%, #2f6a2f 0 40%, transparent 41%), linear-gradient(180deg, #f2c86a, #e89a3a)', accent: '#1f3a1f', emblem: '🌳', dark: true } },
  { id: 'christmas', name: 'Christmas', who: 'Christian', icon: '🎄', greet: 'Merry Christmas!', when: fixed('12-24', 3),
    banner: { bg: 'radial-gradient(1.5px 1.5px at 15% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 70%, #fff, transparent), radial-gradient(1.5px 1.5px at 65% 25%, #fff, transparent), radial-gradient(1.5px 1.5px at 85% 60%, #fff, transparent), linear-gradient(100deg, #0a3a1a, #8a1010)', accent: '#ffd34a', emblem: '🎄', anim: 'twinkle' } },
];

// Banners (banners.js / missions.js): one per holiday, earned by playing during it.
export const HOLIDAY_BANNERS = Object.fromEntries(HOLIDAYS.map((h) => ['hol_' + h.id, h.banner]));
export const HOLIDAY_BANNER_ITEMS = HOLIDAYS.map((h) => ({ id: 'hol_' + h.id, name: `${h.name}`, reward: true, how: `Play a match during ${h.name}` }));

// A holiday's dates in a year: { start, end } (ms, local midnight to midnight), or null.
function span(h, y) {
  const w = h.when(y);
  if (!w) return null;
  const [mm, dd] = w[0].split('-').map(Number);
  const start = new Date(y, mm - 1, dd).getTime();
  return { start, end: new Date(y, mm - 1, dd + w[1]).getTime() };
}

// Holidays on right now: [{ ...holiday, start, end, year }]
export function activeHolidays(now = Date.now()) {
  const y = new Date(now).getFullYear(), out = [];
  for (const h of HOLIDAYS) {
    for (const yy of [y - 1, y]) { // New Year's starts the year before
      const s = span(h, yy);
      if (s && now >= s.start && now < s.end) { out.push({ ...h, ...s, year: yy }); break; }
    }
  }
  return out;
}

// The next holidays coming up (not on yet), soonest first.
export function upcomingHolidays(n = 3, now = Date.now()) {
  const y = new Date(now).getFullYear(), out = [];
  for (const h of HOLIDAYS) {
    for (const yy of [y, y + 1]) {
      const s = span(h, yy);
      if (s && s.start > now) { out.push({ ...h, ...s, year: yy }); break; }
    }
  }
  return out.sort((a, b) => a.start - b.start).slice(0, n);
}
