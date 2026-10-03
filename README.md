# Warehouse FFA

A browser-based 3D multiplayer shooter (Three.js + WebRTC). Free-for-all in an urban warehouse.

## Play

1. One player clicks **Create Lobby** and shares the 5-letter code (or the invite link from the pause menu).
2. Friends enter the code and click **Join**.

The lobby creator's browser acts as the host — if they leave, the lobby ends. Up to 12 players.
First to 25 kills or highest score after 10 minutes wins; a new match starts automatically.

## Run it

Friends need to load the page from somewhere they can reach, so put it online:

- **GitHub Pages** (free): push this repo, then Settings → Pages → deploy from the `main` branch root.
  Everyone opens `https://<user>.github.io/<repo>/`.

To play locally (only you, or to test with two tabs): `node serve.js` → http://localhost:8080

## Loadout

| Slot | Weapon |
|---|---|
| Primary | Assault Rifle, Shotgun, or Grenade Launcher (pick in menu / pause / death screen) |
| Secondary | Pistol |
| Melee | Combat Knife (backstabs one-shot) |
| Utility | 2× Frag Grenade |

The Grenade Launcher one-shots on a direct hit but slows you down while it's out.

## Controls

WASD move · Mouse aim · LMB fire · RMB aim · Space jump · Shift sprint · Ctrl/C crouch ·
R reload · 1–4 / wheel switch · G quick frag · F quick melee · Tab scoreboard · Esc pause
