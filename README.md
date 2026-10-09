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

## Tutorial

New players see **New here? Take the 1-minute tutorial** on the Servers screen. It runs in the Practice Range and walks
through looking, moving, sprinting, jumping, crouching, shooting, aiming down sights, reloading, switching weapons,
quick melee and grenades (with the right buttons for keyboard, controller or touch), then pays 🪙 150 and offers a
real match. Replay it any time from **Keyboard & mouse → Play the tutorial** in the menu.

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

## Map pickups

In Free For All, Team Deathmatch, King of the Hill, Capture the Flag, Domination, Hardpoint, Kill Confirmed, Bounty
Hunter and Last Man Standing, every map has **health packs** (+50 health, back after 20 s), **ammo crates** (full mags
and grenades, back after 25 s) and a **power weapon** in the middle (Railgun, Minigun, Rocket Launcher or Heavy
Sniper Rifle) that appears 30 s into the match and 90 s after someone takes it; everyone is told who has it. The
host can turn pickups off in the host panel.

## Host panel

The lobby creator gets a **Host panel** button in the pause menu (Esc):

- Change mode / map and restart, toggle map rotation
- Rules: score limit, time limit, health, respawn delay, infinite ammo, headshots only, friendly fire, map pickups,
  one shot kills, and **weapons** (any, snipers / shotguns / rifles / pistols / melee / explosives only, or a random
  loadout every life)
- **Rule presets:** Snipers only, One shot one kill, Moon knife fight, Shotgun madness, Pistol duel, Boom boom, Moon
  gravity, Speed demons, Tanks, Headhunters and Chaos. **Save current…** keeps your own, **Copy share code** gives a
  code (R-…) anyone can paste with **Use a code…**. Presets can also be picked when creating a server, and the
  server list shows them.
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
| Sky Islands | Floating grass islands joined by bridges, high corner islands, and jump pads up to a perch over the middle. Fall off and you die |
| Arctic Base | Big snowy research base: labs and barracks with roof access, a radar tower, fuel tanks and a frozen lake |
| Neon Streets | Night city blocks with shops you can walk through, alleys, parked cars and a raised highway down the middle |

## Loadout

**Presets** (top of Loadout and the pause menu's loadout): 6 ready-made ones (Rifleman, Rusher, Sniper, Heavy,
Shotgunner, Fun) plus 3 custom slots. **💾** saves your current weapons with each gun's attachments and wrap, **✎**
renames it, and one click switches back.

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
| Camo | (also in **Character → Customize → Weapon wraps**, with a 3D preview, "apply to all guns", and premium wraps for tokens: Carbon Fiber, Zebra, Toxic, Glacier, Lava, Galaxy, Chrome, Diamond) Default · Crimson · Cobalt · Blackout · Arctic · Gold · Digital · Urban Digital · Desert · Tiger · Neon. Looks only: camos never change stats, and other players see yours. Saved per gun. |

Which options a gun takes depends on its type (pistols can't take scopes, break-action shotguns have no muzzle
slot, and so on). Attachments show on the gun model, and other players see yours too.

| Slot | Options |
|---|---|
| Primary | Assault Rifle, Carbine, Battle Rifle, Burst Rifle, SMG, PDW, Vector, LMG, Minigun, DMR, Sniper Rifle, Heavy Sniper Rifle, Railgun, Shotgun, Auto Shotgun, Slug Shotgun, Double Barrel, Grenade Launcher, Rocket Launcher, Crossbow, Harpoon Gun, Flamethrower (short-range stream of fire, no headshot bonus) |
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

## Levels, daily rewards & challenges

- **XP and levels:** kills (100), headshots (+25), multi-kills (+50), finishing a match (250), winning (+250), the daily
  login (100) and daily challenges all give XP. Your level shows next to your name on the scoreboard and results for
  everyone. Every level pays tokens.
- **Ranks:** Bronze (level 1), Silver (10), Gold (20), Platinum (35), Diamond (50). Each new rank unlocks an earned
  wrap (Silver / Gold / Platinum / Diamond Ace) that can't be bought.
- **Daily login:** claim a reward once a day from the Servers screen or **Missions**. It grows for 7 days in a row
  (🪙 25 → 150); day 7 the first time also gives the **Ember** wrap. Miss a day and the streak starts over.
- **Daily challenges:** 3 a day (easy, medium, hard), the same for everyone on the same date, worth tokens and XP,
  plus a bonus for finishing all 3. They reset at midnight.

## Install as an app

Gun Game 3D can be installed like an app, with its own icon, full screen and no browser bar. Use **Install app** on
the Servers screen (or in the menu sidebar). On iPhone / iPad: Safari → Share → **Add to Home Screen**.

## Ranked

**Play Ranked** (Servers screen) finds a ranked Free For All server near your skill rating (SR), or starts one.
You start at 1,000 SR; after each ranked match your SR moves by where you finished among the real players (bots
don't count, and it needs at least 2 players). The first 5 matches are placements and move it faster. Divisions:
Rookie, Contender (1,100), Veteran (1,250), Elite (1,400), Master (1,550) and Legend (1,700). Ranked servers use the
standard rules, show their rating in the server list, and your division shows on your profile.

## Quick Play & Game Night

- **Quick Play** (top of the Servers screen) drops you into the busiest public server with room, or starts a public
  FFA server with bots if there are none.
- **Game Night** is a set time when everyone plays together. The Servers screen counts down to it (in your own time
  zone); while it's live, **Join game night** puts everyone in the same 🌙 Game Night server (a second one opens if
  it's full). Matches there give **double XP**, and finishing one earns the **Midnight** wrap. Tap **Remind me** to get
  a browser notification when it starts (while the game is open in a tab).
- The owner sets the schedule (days, start time, length, time zone) in **Mod Panel → Announce**. Until then it's every
  day at 7 PM New York time for 2 hours.

## Clans

In **Friends → Clan**, create a clan (a 2–5 letter **[TAG]**, a name and a color) or ask to join one by its tag; the
leader accepts requests, can remove members and can disband it. Members get their **[TAG]** before their name on the
scoreboard and results (only once the clan's signed member list includes them), a clan chat (which also shows in
matches), and the **Clans** tab on the weekly leaderboard ranks clans by their members' XP. Up to 30 members.

## Player profiles

Click a gamertag (your own in **Friends**, a friend, or anyone on the **Leaderboard**) to see their profile: banner,
level and rank, kills, K/D, wins, win rate, matches, headshots, best streak, favorite gun (with its wrap) and season
badges, with an **Add friend** button. Players with a gamertag post their profile automatically.

## Invite friends

**Friends → Invite friends** gives you a link with your gamertag (the pause menu's **Copy invite** includes it too).
When a new player opens it and finishes their first match, you both get 🪙 200, for up to 10 friends.

## Season pass

A free 30-tier pass every 6 weeks (Season 1 **Ignition** started Monday 5 October 2026, then Season 2 **Frostbite**).
All XP you earn fills it, 1,000 XP a tier. Every tier pays tokens; tiers 5, 10, 15, 20, 25 and 30 give season-only
wraps and banners that can't be bought, and tier 30 earns the season badge. See it at the top of **Missions**.

## Featured mode of the day

Every day one mode is featured (the same for everyone): it gives **1.5x XP** (stacks with Game Night) and
🪙 100 for the first match you finish in it that day. **Play it** on the Servers screen joins a public server
playing it, or starts one. Featured servers have a ⭐ in the list.

## Weekly leaderboard

**Leaderboard** in the menu ranks everyone with a gamertag by **XP, kills, wins and headshots** for the week
(Monday 00:00 UTC to the next Monday). Last week's #1 on each board gets a 🏆 next to their name all week (on the
scoreboard and results), plus 500 tokens and the **Weekly Champion** wrap. Each player's game posts its own signed
totals, capped to what's possible in a week; staff can take a player off the board from the Mod Panel
(**Hide from leaderboard**).

## Highlights

If you turn on **Settings → Video → Record highlight clips** (off by default; computers only), the game keeps a short rolling recording of the game screen (never your camera) during matches. When you do something big
(multi-kills, streaks, longshots, headshots, first blood…) it saves that moment, and the results screen shows **your best
moment** of the match as a clip you can **Save** (WebM video) or **Share**. Browsers may show a recording icon while it's on.

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

**Key bindings:** Settings → Controls on a computer. Every action can have two keys, and mouse buttons 3 / 4 / 5
(middle and side buttons) work too. Picking a key that's already used moves it to the new action. Controllers and
touch controls aren't affected. The "Keyboard & mouse" help in the menu shows your current keys.

Open **Settings** from the main menu or the pause menu. Everything is saved in your browser.

| Tab | Options |
|---|---|
| Controls | Mouse sensitivity (desktop) / look sensitivity (touch), aiming sensitivity, invert look, toggle aim with right mouse |
| Controller | Look sensitivity, aiming sensitivity, invert, stick dead zone, aim assist + strength, crouch toggle, auto-sprint, vibration, button layout |
| Video | Field of view, weapon field of view, view bobbing, graphics (**Low-end** for school laptops and old phones: low resolution, no shadows or decorations, shorter view; Low; Normal; High), **auto resolution** (drops the resolution a little when frames dip, on by default), **blood effects** (off shows grey sparks instead), FPS counter. If a match runs very slowly the game suggests Low-end once |
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
  - **Players:** a searchable directory of every claimed gamertag. Type any part of a name (case doesn't matter) and
    each result shows online status, last seen, and banned / muted / warning flags. **NAME** marks a gamertag that breaks
    the filter. **☆ Watch** a player to get a pop-up when they come online (saved on your device). Players who never
    claimed a gamertag can't be looked up and show as **guest** in a match's Moderation list. Open anyone to see their
    warnings, staff notes, ban / mute status and full history, then:
    - **Warn:** a pop-up they must acknowledge, shown next time they play if they're offline.
    - **Add note:** staff-only, not shown to the player.
    - **Mute chat** or **Ban:** 1 hour, 1 day, 7 days, 30 days or permanent. A ban kicks them out of matches and
      blocks hosting and joining until it ends.
    - **Force a new gamertag:** their tag is released and they must pick another.
    - **Unban**, **Unmute**, **Clear warnings**, or **Join their match**.

    It also lists recent actions.
  - **Online:** every public server (spectate or join), and everyone with a gamertag who has the game open and where
    they are, with **Join** and **Look up**.
  - **Reports:** players report each other from the pause menu (**🚩 Report a player**), choosing a reason and adding
    optional details. A small **screenshot** of the reporter's screen goes with it as evidence (click it to enlarge).
    Staff see who reported whom, in which match, and can look either player up, join that match or resolve the report.
  - **Announce:** post a message, either Info or Important, for 1 hour up to "until cleared". Every player sees it at
    the top of the menu, and players in a match get it in chat when it's posted.
  - **Appeals:** banned players can send one appeal per ban from their ban screen. Staff can **Unban** or **Deny**,
    and denied players see it was denied.
  - **Chat filter:** a built-in swear word and slur list (can be switched off) plus your own words. They're starred out
    in lobby and party chat for everyone, and spellings like "sh1t" and "fuuuck" are caught too.
  - **Log:** moderator activity (actions, warns, bans, mutes and kicks per staff member), then every staff action with
    its time, filterable by moderator.
  - **Staff** (owner only): appoint and remove moderators, permanently or for 1, 7 or 30 days.
  - **Recent:** everyone you've played with lately (on this device), with their verified gamertag when known, so you
    can find people after a match.
  - **Quick reasons:** a dropdown of common reasons (Cheating, Toxic chat, Harassment…) fills the reason box.
  - **Staff chat:** a private chat between the owner and moderators. Messages are signed and kept for 3 days, and
    new ones pop up even when the panel is closed.
  - **Kick from match:** on a player who's in a match, removes them from it even if you're not there.

  **Bans enforced by hosts:** players with a gamertag prove it to the host when they join a match. The host's game then
  removes banned players and mutes muted ones (even if their own game was modified to ignore it), and staff see each
  player's real gamertag next to their name in the Moderation list.

  **Anti-spam:** the host's game auto-mutes anyone who sends 6 messages in 8 seconds or the same message 3 times in a
  row (for that match), and files an auto-report when it can.

  **Permanent bans remove the player:** they disappear from the weekly and clan leaderboards (and can't win the
  trophy), their profile can't be opened, they're dropped from clans (a clan they lead is gone), they vanish from
  friend lists and the Mod Panel's directory and recent players (type their exact name to find them), and their gamertag
  becomes free for a new player (the ban is tied to their key, so they can't just take it back). Temporary bans don't do
  this. Unbanning undoes it.

  **Anti-cheat:** the host's game drops shots fired faster than a gun can fire, refuses hits right after a teleport or
  impossible speed, refuses melee hits from out of reach, and counts gun hits that went through solid walls. Repeat
  offenders (3 strikes, or 10+ wall hits making up 30% of their hits) are auto-reported to the Mod Panel, and the host
  panel shows a ⚠ next to them. Limits are generous so lag never gets normal players flagged.

  **Gamertag filter:** gamertags containing filtered words can't be claimed, even hidden inside a name ("xX_Sh1t_Xx").

  Auto-flags: when you host, your game reports players with impossible-looking stats against real players (85%+
  headshot kills, or 8+ kills a minute, over 25+ kills on players). Kills on bots don't count, Gun Game and one-hit modes
  are skipped, and staff and the host aren't checked.

  Moderation tools still work while spectating.

  Every action is signed by the staff member who made it, and players only accept actions from staff ranked above
  them.
- **In a match:** staff get a **Moderation** section in the pause menu to **warn**, **rename**, **freeze** (they can't
  move or shoot), **mute** or **kick** anyone in that match, even players without a gamertag. Staff can also **end**,
  **restart** or **change the map** of the match, even when someone else is hosting, and **lock chat** or turn on
  **slow mode** (one message per 5 seconds) for everyone except staff.
  - Moderators can act on regular players.
  - The owner can also act on moderators.
  - Nobody can kick the host, whose browser runs the match.

There's no server, so bans are enforced by the game itself. Someone determined can get around one by clearing their
browser data or making a new gamertag.

## Run locally

`node serve.js` → http://localhost:8080
