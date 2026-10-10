import { esc } from './util.js';
import { HOLIDAY_BANNERS } from './holidays.js';
import { RANKED_BANNERS } from './ranked.js';

// Player banners: the card shown behind your name when you kill someone ("[BOT] Razor killed you").
// bg is a CSS background, accent tints the edge / emblem, anim adds a moving effect (see .bnr-* in style.css).
export const BANNER_STYLE = {
  standard: { bg: 'linear-gradient(100deg, #1b2029 0%, #262d38 60%, #1b2029 100%)', accent: '#ffb020', emblem: '★' },
  carbon: {
    bg: 'repeating-linear-gradient(45deg, #15181d 0 4px, #1f242b 4px 8px), #15181d', accent: '#9aa4b2', emblem: '◆',
  },
  tiger: {
    bg: 'repeating-linear-gradient(115deg, transparent 0 22px, #120c05 22px 30px, transparent 30px 44px, #120c05 44px 48px), linear-gradient(90deg, #e07a12, #ffae3a)',
    accent: '#ffcf7a', emblem: '🐯',
  },
  camo: {
    bg: 'radial-gradient(circle at 15% 30%, #2f3a22 0 14%, transparent 15%), radial-gradient(circle at 45% 70%, #5a4a2c 0 16%, transparent 17%), radial-gradient(circle at 70% 25%, #1f2616 0 13%, transparent 14%), radial-gradient(circle at 88% 75%, #3d4a2a 0 15%, transparent 16%), radial-gradient(circle at 30% 95%, #1f2616 0 12%, transparent 13%), #4a5a34',
    accent: '#b9c98a', emblem: '✪',
  },
  arctic: {
    bg: 'radial-gradient(circle at 20% 40%, #c9d6e3 0 14%, transparent 15%), radial-gradient(circle at 55% 75%, #8fa3b8 0 15%, transparent 16%), radial-gradient(circle at 80% 30%, #a9bccd 0 13%, transparent 14%), #e8eef4',
    accent: '#3d6fd8', emblem: '❄', dark: true,
  },
  ocean: {
    bg: 'radial-gradient(ellipse at 50% 140%, #3fd0ff55 0 40%, transparent 41%), repeating-radial-gradient(circle at 50% 160%, transparent 0 14px, #ffffff14 14px 16px), linear-gradient(180deg, #0a3d6b, #0d6aa0)',
    accent: '#7fe3ff', emblem: '🌊',
  },
  sunset: {
    bg: 'radial-gradient(circle at 78% 110%, #ffd34a 0 22%, #ff8a3a 23% 30%, transparent 31%), linear-gradient(180deg, #2a1146, #8a2a6a 55%, #ff7a45)',
    accent: '#ffd34a', emblem: '☀',
  },
  toxic: {
    bg: 'repeating-linear-gradient(135deg, #f2d21b 0 14px, #121212 14px 28px)', accent: '#8fff4a', emblem: '☢',
  },
  neon: {
    bg: 'linear-gradient(90deg, #ff2fd855 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(0deg, #2fe6ff55 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(100deg, #12051f, #1b0b33)',
    accent: '#ff2fd8', emblem: '⚡', anim: 'scroll',
  },
  blood: {
    bg: 'radial-gradient(circle at 18% 40%, #7a0008 0 10%, transparent 11%), radial-gradient(circle at 26% 62%, #9b000c 0 4%, transparent 5%), radial-gradient(circle at 72% 30%, #7a0008 0 7%, transparent 8%), radial-gradient(circle at 80% 70%, #9b000c 0 12%, transparent 13%), linear-gradient(100deg, #1a0204, #3a0408)',
    accent: '#ff3b3b', emblem: '☠',
  },
  matrix: {
    bg: 'repeating-linear-gradient(90deg, transparent 0 9px, #1aff6a22 9px 11px), repeating-linear-gradient(180deg, #1aff6a18 0 3px, transparent 3px 7px), #020a04',
    accent: '#3aff7a', emblem: '⌬', anim: 'rain',
  },
  flames: {
    bg: 'radial-gradient(ellipse at 15% 120%, #ffdf4a 0 18%, transparent 40%), radial-gradient(ellipse at 45% 130%, #ff8a1a 0 22%, transparent 45%), radial-gradient(ellipse at 80% 125%, #ffb02a 0 18%, transparent 42%), linear-gradient(180deg, #1a0500, #6a1300 60%, #d63a00)',
    accent: '#ffcc33', emblem: '🔥', anim: 'flicker',
  },
  galaxy: {
    bg: 'radial-gradient(1px 1px at 12% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 35% 70%, #fff, transparent), radial-gradient(1px 1px at 58% 20%, #fff, transparent), radial-gradient(1.5px 1.5px at 76% 60%, #fff, transparent), radial-gradient(1px 1px at 90% 35%, #fff, transparent), radial-gradient(ellipse at 60% 50%, #7a3aff66, transparent 60%), radial-gradient(ellipse at 25% 60%, #ff3aa855, transparent 55%), #0a0618',
    accent: '#c9a8ff', emblem: '✦', anim: 'twinkle',
  },
  dragon: {
    bg: 'radial-gradient(circle at 50% 100%, transparent 0 9px, #00000080 10px 11px, transparent 12px) 0 0 / 22px 14px, linear-gradient(100deg, #3a0000, #8a0b0b 50%, #3a0000)',
    accent: '#ffb020', emblem: '🐉',
  },
  rainbow: {
    bg: 'linear-gradient(100deg, #ff3b3b, #ffb020, #ffe94a, #3bd16f, #3b9cff, #8a4bff, #ff3b3b)', accent: '#ffffff', emblem: '✿', anim: 'hue',
  },
  gold: {
    bg: 'linear-gradient(100deg, #6b4a0a 0%, #c99a1e 25%, #fff0a8 45%, #e2b23a 60%, #7a560c 100%)', accent: '#fff3b0', emblem: '♛', anim: 'shine', dark: true,
  },
  diamond: {
    bg: 'linear-gradient(120deg, transparent 0 30%, #ffffff55 40%, transparent 50%), conic-gradient(from 30deg at 30% 50%, #bfefff, #e8f9ff, #9fd8ff, #d8c8ff, #bfefff), #bfefff',
    accent: '#ffffff', emblem: '💎', anim: 'shine', dark: true,
  },
};

// Holiday banners (holidays.js)
Object.assign(BANNER_STYLE, HOLIDAY_BANNERS);
// Ranked season banners (ranked.js)
Object.assign(BANNER_STYLE, RANKED_BANNERS);

// Season pass banners (seasons.js)
Object.assign(BANNER_STYLE, {
  s1: { bg: 'radial-gradient(circle at 85% 50%, #ffb02055 0 20%, transparent 45%), linear-gradient(100deg, #1a0d06, #5a1e08 60%, #ff7a2a)', accent: '#ffb020', emblem: '🔥' },
  s1elite: { bg: 'repeating-linear-gradient(120deg, transparent 0 18px, #ffd23a22 18px 22px), linear-gradient(100deg, #2a0a04, #b8360a 50%, #ffd23a)', accent: '#fff0b0', emblem: '🏅', anim: 'shine' },
  s2: { bg: 'radial-gradient(circle at 85% 50%, #bfefff55 0 20%, transparent 45%), linear-gradient(100deg, #06101a, #0a3a5a 60%, #6fd8ff)', accent: '#bfefff', emblem: '❄' },
  s2elite: { bg: 'repeating-linear-gradient(60deg, transparent 0 18px, #ffffff22 18px 22px), linear-gradient(100deg, #0a0a2a, #3a5ad8 50%, #c9a8ff)', accent: '#ffffff', emblem: '💠', anim: 'shine' },
});

export const bannerOf = (id) => BANNER_STYLE[id] || BANNER_STYLE.standard;

// Banner card markup. `top` is a small label above the name, `sub` a line of chips under it.
export function bannerHtml(id, name, nameColor, top = '', sub = '') {
  const b = bannerOf(id);
  return `<div class="bnr ${b.anim ? 'bnr-' + b.anim : ''} ${b.dark ? 'bnr-light' : ''}" style="--bg:${b.bg};--ac:${b.accent}">
    <div class="bnr-emblem"><span>${b.emblem}</span></div>
    <div class="bnr-text">${top ? `<div class="bnr-top">${top}</div>` : ''}<div class="bnr-name" style="color:${esc(nameColor || '#fff')}">${esc(name)}</div>${sub ? `<div class="bnr-sub">${sub}</div>` : ''}</div>
  </div>`;
}
