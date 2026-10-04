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
| Gun Game | Each kill moves you to the next of 13 weapons; finish with a knife kill. Melee kills demote the victim |
| King of the Hill | Stand in the zone alone to score points; it moves every minute. First to 90 |
| Infection | After 10s one player becomes a zombie; anyone killed joins them. Survive the 4 minutes |
| Hardpoint | Red vs Blue over a moving zone; your team scores while it's the only team inside. First to 150 |
| Juggernaut | First kill makes you the Juggernaut (4x health, minigun). Kill it to take over. Only Juggernaut kills and Juggernaut takedowns score. First to 15 |
| Last Man Standing | 3 lives each (the score limit), no respawns once you're out. Last player with lives wins |
| Instagib | Every hit kills, with your own loadout. First to 25 |
| Snipers Only | Sniper rifles and revolvers. First to 20 |
| Shotgun Brawl | Shotgun, sawed-off and flashbangs. First to 25 |
| Blade Party | Katana, axe, knife and throwing knives; faster movement and higher jumps. First to 20 |
| Boom Town | Rocket launcher, grenade launcher, bat and stickies. First to 25 |
| Roulette | A random loadout every time you spawn. First to 25 |
| Vampire | No health regen; damage you deal heals you and kills heal more. First to 25 |
| Moon Gravity | Low gravity and big jumps. First to 25 |
| Kill Confirmed | Red vs Blue. Kills drop dog tags: grab enemy tags to score, your team's to deny. First team to 40 |
| One in the Chamber | Revolver with one bullet that kills in one hit, no reloading; each kill gives a bullet back. First to 20 |
| Weapon Rotation | Everyone has the same random weapon, changing every 40 seconds. First to 25 |
| Hardcore | 35 health and no regeneration. First to 25 |
| Sidearms | Hand Cannon and Revolver only. First to 25 |

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
| Snow Outpost | Snowy base with a climbable bunker, watchtowers, huts and sandbags |
| Office Tower | Two floors around a central atrium, offices, cubicles and staircases |
| Jungle Ruins | Four-sided temple pyramid, broken columns and ruined walls |
| Harbor Docks | Two quays split by a wadeable water channel, bridges, boats, brick sheds with roof access, a gantry crane |
| Colosseum | Sand arena with raised stands all round, a central dais, obelisks and broken walls |
| Military Compound | Walled base: rooms off a central yard, doorways, a catwalk, sandbags and crates |
| Rooftops | Night city: climb fire escapes and cross plank bridges between rooftops around a central tower |
| Space Station | Four-way sci-fi deck around a glowing reactor with a raised ring walkway and corner rooms |
| Canyon | Two mesas facing each other across a canyon floor, joined by a rope bridge |
| Construction Site | Three-storey concrete frame with stairs and an open atrium, containers, pipes and a tower crane |
| Cargo Ship | Deck of a container ship at sea: cargo stacks, hatches, a mast and bridge houses with roof access at both ends |
| Train Yard | Parked train cars across four tracks, platforms on both sides and a footbridge over everything |
| Frozen Lake | Open ice with fishing huts and ice blocks, snowy shore banks with ramps and pine trees |

## Loadout

Pick one per slot in the menu or pause menu (applies on next spawn). Hover a weapon to see its damage, fire rate, range and mobility.

| Slot | Options |
|---|---|
| Primary | Assault Rifle, Battle Rifle, Carbine, SMG, PDW, Vector, Burst Rifle, LMG, DMR, Laser Rifle, Minigun (spins up), Sniper Rifle (scoped), Anti-Materiel Rifle (scoped, one-shots), Railgun, Shotgun, Auto Shotgun, Slug Shotgun, Double Barrel, Grenade Launcher, Rocket Launcher, Crossbow, Harpoon Gun |
| Secondary | Pistol, Burst Pistol, Revolver, Auto Revolver, Machine Pistol, Micro SMG, Hand Cannon, Sawed-Off, Flare Gun |
| Melee | Combat Knife, Brass Knuckles, Machete, Fire Axe, Katana, Baseball Bat (knockback), Sledgehammer (big knockback), Scythe — backstabs one-shot |
| Utility | Frag, Sticky, Impact (explodes on contact), Vortex (pulls players in), Smoke, Flashbang, Throwing Knives |

## Party chat

Press **Enter** (PC) or tap **💬** (phones/tablets) to type to everyone in the lobby. The chat box is always open on
the pause screen. Messages fade after a few seconds; turn chat off in Settings → HUD & Audio.

## Aim assist (phones & tablets)

On touch screens, aim slows down while your crosshair is on an enemy, gently tracks them while you shoot or aim down
sights, and snaps a little toward a nearby enemy when you start aiming. Toggle it or set its strength in
Settings → Controls.

The Grenade Launcher one-shots on a direct hit but slows you down while it's out.

## Controls

WASD move · Mouse aim · LMB fire · RMB aim/scope · Space jump · Shift sprint · Ctrl/C crouch ·
R reload · 1–4 / wheel switch · Q last weapon · G quick grenade · F quick melee · T inspect · Tab scoreboard · Esc pause/loadout

Switching holsters your current weapon before drawing the next (heavier weapons take longer). Quick melee (F) swings
immediately and then puts your previous weapon back in your hands. When you throw your last grenade you go back to
the weapon you had out before.

## Settings

Open **Settings** from the main menu or the pause menu. Everything is saved in your browser.

| Tab | Options |
|---|---|
| Controls | Mouse sensitivity (desktop) / look sensitivity (touch), aiming sensitivity, invert look, toggle aim with right mouse |
| Video | Field of view, weapon field of view, view bobbing, graphics High/Low, FPS counter |
| HUD & Audio | Volume, crosshair color, size and center dot |
| Mobile | Edit button layout (drag any touch button anywhere, resize each one), button size, button opacity |
| Missions | 37 missions (kills, headshots, sniper / shotgun / melee / secondary / explosive kills, streaks, matches, wins, maps and modes played, mode-specific goals). Each one pays tokens 🪙 |
| Customize | 17 hats, 7 hair styles (+ colors), 8 face items and 8 back items. Tap anything to preview it on your character, then spend tokens on whatever you want. Other players see what you wear |

## Mobile

Phones and tablets get touch controls automatically (play in landscape):
floating joystick on the left, drag on the right to look, and buttons for fire (drag it to aim while shooting),
aim, jump, crouch, reload, weapon swap (toggles primary/secondary), grenade, melee, scoreboard and pause.
Tablets get **tablet mode** automatically: a fuller HUD, a tappable weapon slot bar, slightly larger buttons,
sharper graphics, and portrait play (with a wider view so the gun stays on screen).
Rearrange or resize the buttons in **Settings → Mobile → Edit layout**, and pick Auto / Phone / Tablet / Desktop
under **Settings → Mobile → Interface mode**.
Add `?mobile`, `?tablet` or `?desktop` to the URL to force a mode, and `?lowgfx` to force low graphics.

## Run locally

`node serve.js` → http://localhost:8080
