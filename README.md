# Warehouse FFA

A browser-based 3D multiplayer shooter (Three.js + WebRTC) to play with friends, with bots.

**Play:** https://merchantsteam29.github.io/Gun-game-fun/

## How to play

1. One player picks a game mode and starting map and clicks **Create Lobby**, then shares the 5-letter code (or the invite link from the pause menu).
2. Friends enter the code and click **Join**.

The lobby creator's browser acts as the host — if they leave, the lobby ends. Up to 12 players.
The next match starts automatically on the next map.

## Game modes

| Mode | Rules |
|---|---|
| Free For All | First to 25 kills |
| Team Deathmatch | Red vs Blue, first team to 50 kills |
| Gun Game | Each kill moves you to the next of 11 weapons; finish with a knife kill. Melee kills demote the victim |
| King of the Hill | Stand in the zone alone to score points; it moves every minute. First to 90 |
| Infection | After 10s one player becomes a zombie; anyone killed joins them. Survive the 4 minutes |

## Host panel

The lobby creator gets a **Host panel** button in the pause menu (Esc):

- Change mode / map and restart, toggle map rotation
- Rules: score limit, time limit, health, respawn delay, infinite ammo, headshots only, friendly fire
- Physics: game speed, move speed, jump height, gravity
- Bots: add (easy / normal / hard), fill to 8, change difficulty, remove
- Players: kick, swap teams

## Maps

| Map | Style |
|---|---|
| Warehouse | Indoor, two mezzanines, containers and crates |
| Container Yard | Outdoor, stacked containers, central towers joined by a bridge |
| Desert Town | Adobe buildings you can enter, rooftops, market stalls |
| Neon Pit | Small night arena with a central platform and jump pads |

## Loadout

Pick one per slot in the menu or pause menu (applies on next spawn).

| Slot | Options |
|---|---|
| Primary | Assault Rifle, SMG, Burst Rifle, LMG, Sniper Rifle (scoped), Shotgun, Grenade Launcher |
| Secondary | Pistol, Revolver, Machine Pistol |
| Melee | Combat Knife, Fire Axe (backstabs one-shot) |
| Utility | Frag Grenade, Sticky Grenade, Smoke Grenade |

The Grenade Launcher one-shots on a direct hit but slows you down while it's out.

## Controls

WASD move · Mouse aim · LMB fire · RMB aim/scope · Space jump · Shift sprint · Ctrl/C crouch ·
R reload · 1–4 / wheel switch · G quick grenade · F quick melee · T inspect · Tab scoreboard · Esc pause/loadout

## Run locally

`node serve.js` → http://localhost:8080
