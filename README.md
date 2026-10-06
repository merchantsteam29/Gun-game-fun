# Gun Game 3D

A browser-based 3D multiplayer shooter (Three.js + WebRTC) to play with friends, with bots.

**Play:** https://merchantsteam29.github.io/Gun-game-fun/

## How to play

Everything starts in the **Servers** tab:

- **Join with code:** type a friend's 5-letter code (from their pause menu or invite link). Works for private servers too.
- **Find servers:** a live list of public servers (name, mode, map, players, region). Tap **Join** on any open one.
- **Create server:** pick a name, **Public** (listed in Find Servers) or **Private** (hidden, code / invite link only),
  max players (2–12), fill with bots (bots leave as real players join), a region tag, map rotation, the game mode and
  the starting map. The host can switch public/private any time from the Host panel.

The creator's browser is the host: if they leave, the server closes. The next match starts automatically on the next map.

The server list uses a free public relay (no account needed), so public server names are visible to anyone.
If the relay is down you can still create servers and join with codes.

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
| Blade Party | Katana, axe, knife and throwing knives; faster movement and higher jumps. First to 20 |
| Boom Town | Rocket launcher, grenade launcher, bat and stickies. First to 25 |
| Roulette | A random loadout every time you spawn. First to 25 |
| Vampire | No health regen; damage you deal heals you and kills heal more. First to 25 |
| Kill Confirmed | Red vs Blue. Kills drop dog tags: grab enemy tags to score, your team's to deny. First team to 40 |
| One in the Chamber | Revolver with one bullet that kills in one hit, no reloading; each kill gives a bullet back. First to 20 |
| Weapon Rotation | Everyone has the same random weapon, changing every 40 seconds. First to 25 |
| Capture the Flag | Red vs Blue. Grab the enemy flag and bring it to your base while your own flag is home. Dropped flags return after 20s, or touch your own to return it. First to 3 captures |
| Bounty Hunter | The leader carries a bounty (gold). Killing them is worth 3 points, anyone else 1. First to 30 |
| Domination | Red vs Blue over three zones A, B, C. Stand in a zone with only your team to capture it; each zone you own scores a point per second. First to 200 |

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
| Harbor Docks | Two quays split by a wadeable water channel, bridges, boats, brick sheds with roof access, a gantry crane |
| Colosseum | Sand arena with raised stands all round, a central dais, obelisks and broken walls |
| Military Compound | Walled base: rooms off a central yard, doorways, a catwalk, sandbags and crates |
| Rooftops | Night city: climb fire escapes and cross plank bridges between rooftops around a central tower |
| Space Station | Four-way sci-fi deck around a glowing reactor with a raised ring walkway and corner rooms |
| Canyon | Two mesas facing each other across a canyon floor, joined by a rope bridge |
| Construction Site | Three-storey concrete frame with stairs and an open atrium, containers, pipes and a tower crane |
| Castle | Walled courtyard with four gates, a central keep with a rooftop, rampart walkways and corner towers |
| Airplane Hangar | A parked plane inside a big open hangar, side catwalks, and tarmac with fuel trucks out both doors |
| Shopping Mall | Two floors of shops around an atrium with a fountain, escalators and a skylight |
| Jungle Temple | A stepped pyramid with a shrine on top and stairs on every side, a pillared plaza and mossy corner ruins |
| Oil Rig | Offshore platform: drilling derrick in the middle, two raised decks (one with a helipad), containers and pipes |
| Subway | Two platforms either side of a sunken track with parked trains, a footbridge over the tracks and steps down at the ends |

## Loadout

Pick one per slot in the menu or pause menu (applies on next spawn). Weapons are grouped by class and each shows how
many shots it takes to kill and how fast; hover (or focus with a controller) to see exact damage, headshot damage,
fire rate, reload and damage drop-off.

**Balance:** every gun is tuned around time-to-kill at 100 health. Rifles kill in about 0.38–0.48s and keep most of
their damage at range; SMGs are faster up close (~0.33s) but fall off with distance; pistols sit a little slower
(~0.45–0.5s) with short drop-off; snipers and slugs reward headshots; shotguns one-shot only up close. Melee weapons
trade swing speed for reach and movement speed, and only the Sledgehammer one-shots from the front.

### Attachments

Every gun has an **Attachments** panel on its card in Loadout (hover an option to preview its stats):

| Slot | Options |
|---|---|
| Optic | Iron sights (fastest to aim) Â· Red dot Â· Holographic (steadier) Â· 2.5Ã— scope (magnified, slower to aim) Â· 6Ã— sniper scope (snipers / DMR / energy weapons) |
| Muzzle | Standard Â· Suppressor (quiet, no muzzle flash for others, damage drops off a bit sooner) Â· Compensator (30% less recoil) |
| Magazine | Standard Â· Extended (+50% ammo, slower reload, slightly slower movement) Â· Fast mag (25% faster reload) |
| Underbarrel | None Â· Vertical grip (less recoil, steadier on the move) Â· Laser (tighter hip-fire) |

Which options a gun takes depends on its type (pistols can't take scopes, break-action shotguns have no muzzle
slot, and so on). Attachments show on the gun model, and other players see yours too.

| Slot | Options |
|---|---|
| Primary | Assault Rifle, Carbine, Battle Rifle, Burst Rifle, Laser Rifle, SMG, PDW, Vector, LMG, Minigun, DMR, Sniper Rifle, Anti-Materiel Rifle, Railgun, Shotgun, Auto Shotgun, Slug Shotgun, Double Barrel, Grenade Launcher, Rocket Launcher, Crossbow, Harpoon Gun |
| Secondary | Pistol, Burst Pistol, Hand Cannon, Revolver, Auto Revolver, Machine Pistol, Micro SMG, Sawed-Off, Flare Gun |
| Melee | Combat Knife, Katana, Baseball Bat (knockback), Fire Axe, Sledgehammer (one-shot, knockback) — backstabs one-shot |
| Utility | Frag, Sticky, Throwing Knives, Smoke, Flashbang, Vortex (pulls players in) |

## Party chat

Press **Enter** (PC) or tap **💬** (phones/tablets) to type to everyone in the lobby. The chat box is always open on
the pause screen. Messages fade after a few seconds; turn chat off in Settings → HUD & Audio.

## Aim assist (controllers, phones & tablets)

With a controller or on a touch screen, aim slows down while your crosshair is on an enemy, gently tracks them while
you shoot or aim down sights, and snaps a little toward a nearby enemy when you start aiming. Toggle it or set its
strength in Settings → Controller (or Controls on touch devices).

## Controller

Plug in or pair any standard controller (Xbox, PlayStation, Switch Pro, most Bluetooth pads) and press a button — the
game switches to controller mode (touching the mouse or keyboard switches back).

| Input | Action |
|---|---|
| Left stick / right stick | Move / look |
| RT / LT | Fire / aim down sights |
| A / B | Jump / crouch (slide while sprinting) |
| X / Y | Reload / switch weapon |
| RB / LB or R3 | Grenade / quick melee |
| L3 | Sprint |
| D-pad ◀ ▶ / ▲ / ▼ | Previous–next weapon / melee weapon / inspect |
| View / Menu | Scoreboard / pause |

Every menu works with the controller too: D-pad or left stick moves, **A** selects, **B** goes back, **LB/RB** switch
menu sections or settings tabs, **LT/RT** switch loadout slots, the right stick scrolls, and left/right changes sliders.
Settings → Controller has look sensitivity, invert, dead zone, aim assist, crouch toggle, auto-sprint and vibration.

The Grenade Launcher one-shots on a direct hit but slows you down while it's out.

## Controls

WASD move · Mouse aim · LMB fire · RMB aim/scope · Space jump · Shift sprint · Ctrl/C crouch ·
R reload · 1–4 / wheel switch · Q last weapon · G quick grenade · F quick melee · T inspect · Tab scoreboard · Esc pause/loadout

**Movement:** crouch while sprinting to **slide** (a burst of speed you can jump out of). You stay on the ground
walking down stairs, can still jump for a moment after running off a ledge, a jump pressed just before landing
still counts, and you hop onto edges you only just clip when jumping.

**Headshots:** the head hitbox follows the player model (crouching, leaning, looking up/down). Headshots get a gold
hitmarker and a "tink"; headshot kills show **HEADSHOT** (with a streak count), knock the victim's hat off, and are
marked in the kill feed and on the victim's death screen.

Switching holsters your current weapon before drawing the next (heavier weapons take longer). Quick melee (F) swings
immediately and then puts your previous weapon back in your hands. When you throw your last grenade you go back to
the weapon you had out before.

## Banners

Your **banner** is the card shown behind your name on the death screen of everyone you kill
("**[BOT] Razor** — KILLED YOU", with the weapon and a headshot tag). Pick one in **Character → Banner**:
Standard and Carbon are free; Tiger, Woodland / Arctic Camo, Ocean, Sunset, Hazard, Bloodbath, Neon Grid, Code Rain,
Inferno, Galaxy, Dragon Scale, Rainbow, Solid Gold and Diamond cost tokens (several are animated). Bots wear random ones.
## HUD

- **Minimap** (top-left; top-right on phones and tablets): rotates with you and shows the map layout, teammates (blue
  dots), objectives (hills, Domination zones, flags) and enemies for a couple of seconds after they fire an
  unsuppressed gun. Suppressors keep you off it.
- **Score strip** around the timer: your team vs. the enemy team, or you vs. the best other player in free-for-all
  modes, with progress bars toward the score limit.
- **Kill banner** for every kill, with multi-kill (double, triple, quad, mega) and streak (killing spree, rampage,
  unstoppable, legendary, godlike) call-outs.
- **Reload ring** around the crosshair that fills as you reload.
- Scoreboard (Tab) with rank and K/D; the end screen shows a podium for the top three.
## Settings

Open **Settings** from the main menu or the pause menu. Everything is saved in your browser.

| Tab | Options |
|---|---|
| Controls | Mouse sensitivity (desktop) / look sensitivity (touch), aiming sensitivity, invert look, toggle aim with right mouse |
| Controller | Look sensitivity, aiming sensitivity, invert, stick dead zone, aim assist + strength, crouch toggle, auto-sprint, vibration, button layout |
| Video | Field of view, weapon field of view, view bobbing, graphics High/Low, FPS counter |
| HUD & Audio | Volume, party chat, voice chat, minimap on/off, HUD size, crosshair color, size and center dot |
| Mobile | Edit button layout (drag any touch button anywhere, resize each one), button size, button opacity |
| Missions | 50 missions (kills, headshots, sniper / shotgun / melee / secondary / explosive kills, streaks, multi-kills, long shots, revenge, airborne, suppressed and low-health kills, matches, wins, team wins, maps and modes played, mode-specific goals, collecting cosmetics). Each one pays tokens 🪙 |
| Customize | 23 hats, 9 hair styles (+ colors), 12 face items, 12 back items and 17 banners. Tap anything to preview it, then spend tokens on whatever you want. Other players see what you wear |

## Mobile

Phones and tablets get touch controls automatically (play in landscape):
floating joystick on the left, drag on the right to look, and buttons for fire (drag it to aim while shooting),
aim, jump, crouch, reload, weapon swap (toggles primary/secondary), grenade, melee, scoreboard and pause.
Tablets get **tablet mode** automatically: a fuller HUD, a tappable weapon slot bar, slightly larger buttons,
sharper graphics, and portrait play (with a wider view so the gun stays on screen).
Rearrange or resize the buttons in **Settings → Mobile → Edit layout**, and pick Auto / Phone / Tablet / Desktop
under **Settings → Mobile → Interface mode**.
Add `?mobile`, `?tablet` or `?desktop` to the URL to force a mode, and `?lowgfx` to force low graphics.

## Updates

The game checks `version.json` every minute. When a new version is out, a pop-up lists what's new and
re-downloads every file (a hard refresh) — automatically after 5 seconds in the menu, or when you choose
(**Update now** / **After this server**) while playing.

**Releasing:** bump the version in both `js/version.js` and `version.json` (same string), update the notes,
and add any new files to the `files` list in `version.json`.

## Gamertag, friends & party chat

On your first visit you pick a **gamertag**: it's your name in every match, it's unique (no one else can have it,
whatever capitals they use) and you only get one. In **Friends**:

- Type someone's gamertag and **Send friend request**; they accept or decline it (requests wait for them if they're
  offline). Friends show as online / in the menu / in a match, with **Join game** when they're playing.
- **Invite to party** starts a party (you lead it). The party chats together in the Friends screen, and in matches
  by starting a message with `/p`. When the leader starts or joins a match, party members get a
  **Join the party leader's match** button.
- **Voice chat:** in the party card press **🎤 Join voice** (allow the microphone). Everyone in the party who joined voice
  can hear each other, in the menu and in matches. Mute any time; turn on **Push to talk** (hold **V**) and set the voice
  volume in Settings → HUD & Audio. In matches, the top-left shows who's talking. Voice goes straight between players
  (peer-to-peer); only party members can connect.

This runs over the same free public relays as the server list (no account or server of our own). Every request,
message and status update is signed with a key stored on your device, so nobody can send things as you. Clearing the
browser's site data loses that key (and with it your gamertag on that device). A gamertag nobody uses for 120 days
becomes free again.

## Run locally

`node serve.js` → http://localhost:8080
