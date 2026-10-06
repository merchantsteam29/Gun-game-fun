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

The creator's browser is the host: if they leave, the server closes.

**End of match:** first the **MVP card** shows the best player of the match: kills, deaths, K/D, score, headshots and
best streak, on their banner. Then (with map rotation on) everyone **votes for the next map** out of 3 random ones.
- **Voting:** click a card, press 1 / 2 / 3, or use X / Y / B on a controller. One vote each, and it's final.
- **Counts:** they update live for everyone.
- **Winner:** most votes wins, and ties are settled at random.

With rotation off, the same map comes back.

**🎯 Practice Range** (main menu): solo and offline, on its own range map.
- **Targets:** standing targets at 4, 10, 20, 30, 50 and 75 m, plus moving ones at 15, 25 and 40 m. Stripes on the
  floor mark every 10 m.
- **Damage numbers:** they pop up on every hit, gold for headshots.
- **Weapons:** the pause menu (Esc) lists every weapon, and picking one equips it straight away.
- **Rules:** an infinite-ammo toggle, no timer and no score limit. Practice kills don't count for missions.

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
| Optic | Iron sights (fastest to aim) · Red dot · Holographic (steadier) · 2.5× scope (magnified, slower to aim) · 6× sniper scope (snipers / DMR / energy weapons) |
| Muzzle | Standard · Suppressor (quiet, no muzzle flash for others, damage drops off a bit sooner) · Compensator (30% less recoil) |
| Magazine | Standard · Extended (+50% ammo, slower reload, slightly slower movement) · Fast mag (25% faster reload) |
| Underbarrel | None · Vertical grip (less recoil, steadier on the move) · Laser (tighter hip-fire) |
| Camo | Default · Crimson · Cobalt · Blackout · Arctic · Gold · Digital · Urban Digital · Desert · Tiger · Neon. Looks only: camos never change stats, and other players see yours. Saved per gun. |

Which options a gun takes depends on its type (pistols can't take scopes, break-action shotguns have no muzzle
slot, and so on). Attachments show on the gun model, and other players see yours too.

| Slot | Options |
|---|---|
| Primary | Assault Rifle, Carbine, Battle Rifle, Burst Rifle, Laser Rifle, SMG, PDW, Vector, LMG, Minigun, DMR, Sniper Rifle, Anti-Materiel Rifle, Railgun, Shotgun, Auto Shotgun, Slug Shotgun, Double Barrel, Grenade Launcher, Rocket Launcher, Crossbow, Harpoon Gun, Flamethrower (short-range stream of fire, no headshot bonus) |
| Secondary | Pistol, Burst Pistol, Hand Cannon, Revolver, Auto Revolver, Machine Pistol, Micro SMG, Sawed-Off, Flare Gun, Nailgun (rapid-fire nails that stick) |
| Melee | Combat Knife, Katana, Baseball Bat (knockback), Fire Axe, Sledgehammer (one-shot, knockback), Frying Pan (two hits, *clang*) — backstabs one-shot |
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
- **Medals** for real kill events, queued one at a time near the top of the screen (clear of the crosshair): First
  Blood, Double / Triple / Multi Kill, Killing Spree, Rampage, Unstoppable, Legendary, Godlike, Shutdown (ending
  someone's streak), Revenge, Headshot, Melee Kill, Boom (explosives) and Longshot (40 m+).
- **Kill confirm:** a small "ELIMINATED <name>" line under the crosshair for each of your kills.
- **After dying:** the camera shows your killer. With a longer respawn (or once you're out in Last Man Standing), you
  then watch living players (teammates in team modes) until you respawn. Q / E or click to switch.
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

## Staff: owner & moderators

**GIGACHAD** is the game's owner. Staff get a badge (♛ OWNER or 🛡 MOD) everywhere names show:
- in matches: the name tag above their head, scoreboard, kill feed, chat, death screen and end screen;
- in the menus: friends list and the **Staff** list in the Friends tab.

- **Can't be faked:** the owner badge is tied to the GIGACHAD gamertag's key, not the name. In a match, staff prove
  who they are to the host with a signed message. Anyone else who joins using a staff name is renamed to
  "Imposter###" after a few seconds.
- **Moderators:** the owner appoints them in **Friends → Staff** by typing their gamertag. Appointments are signed with
  the owner's key, so nobody else can make moderators. Only the owner can remove them.
- **Mod Panel:** a menu section only staff see, with live stats (online now, open reports, active bans, moderators)
  and these tabs:
  - **Players:** look up any gamertag to see its warnings, staff notes, ban / mute status and full history, then:
    - **Warn:** a pop-up they must acknowledge, shown next time they play if they're offline.
    - **Add note:** staff-only, not shown to the player.
    - **Mute chat** or **Ban:** 1 hour, 1 day, 7 days, 30 days or permanent. A ban kicks them out of matches and
      blocks hosting and joining until it ends.
    - **Force a new gamertag:** their tag is released and they must pick another.
    - **Unban**, **Unmute**, **Clear warnings**, or **Join their match**.

    It also lists recent actions.
  - **Online:** everyone with a gamertag who has the game open and where they are, with **Join** and **Look up**.
  - **Reports:** players report each other from the pause menu (**🚩 Report a player**), choosing a reason and adding
    optional details. Staff see who reported whom, in which match, and can look either player up, join that match or
    resolve the report.
  - **Announce:** post a message, either Info or Important, for 1 hour up to "until cleared". Every player sees it at
    the top of the menu, and players in a match get it in chat when it's posted.
  - **Appeals:** banned players can send one appeal per ban from their ban screen. Staff can **Unban** or **Deny**,
    and denied players see it was denied.
  - **Chat filter:** a built-in swear word and slur list (can be switched off) plus your own words. They're starred out
    in lobby and party chat for everyone, and spellings like "sh1t" and "fuuuck" are caught too.
  - **Log:** every staff action with its time, filterable by moderator.
  - **Staff** (owner only): appoint and remove moderators, permanently or for 1, 7 or 30 days.

  Auto-flags: when you host, your game reports players with impossible-looking stats (80%+ headshot kills over 15+ gun
  kills, or 6+ kills a minute over 20+ kills). They show in Reports, marked as automatic.
- **👁 Spectate:** staff can watch any match invisibly from the Online, Reports or player views. There's no player,
  avatar or scoreboard entry.
  - Follow camera: Q / E or click to switch players, mouse to orbit.
  - Free camera: F, then WASD, Space / C for up and down, Shift to go faster.

  Moderation tools still work while spectating.

  Every action is signed by the staff member who made it, and players only accept actions from staff ranked above
  them.
- **In a match:** staff get a **Moderation** section in the pause menu to **warn**, **rename**, **freeze** (they can't
  move or shoot), **mute** or **kick** anyone in that match, even players without a gamertag. Staff can also **end**,
  **restart** or **change the map** of the match, even when someone else is hosting.
  - Moderators can act on regular players.
  - The owner can also act on moderators.
  - Nobody can kick the host, whose browser runs the match.

There's no server, so bans are enforced by the game itself. Someone determined can get around one by clearing their
browser data or making a new gamertag.

## Run locally

`node serve.js` → http://localhost:8080
