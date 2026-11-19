# Solmar City

An open-world crime game for the [make.fun](https://make.fun/bounty/gta6-01) `gta6-01` bounty — built in the spirit of GTA 6, playable in a desktop browser from static files with no network requests, keyboard and mouse.

Everything in the city, characters, vehicles, names, story, art, sound and music is original — nothing from Rockstar Games.

## The game

Jax Marlowe is out and owes Rosa's garage one last favour. Explore sunny Solmar City on foot and by car: steal cars, outrun the Solmar police, and run five story jobs — from a first set of wheels to the grand getaway across the North Bridge. Then keep the city in free roam.

- **Open city** — a grid of avenues and streets with traffic, pedestrians, parks, a plaza and a beach; a minimap and mission markers keep you oriented.
- **On foot and by car** — walk, sprint, steal parked and traffic cars, drive with arcade handling, skid marks and crashes.
- **Wanted level** — 0 to 5 stars. Stealing, hitting pedestrians and shooting draw the police: patrol cars that chase and ram, foot cops that run you down to make an arrest.
- **Missions and story** — five jobs with briefings, timers, a getaway and an on-foot shootout in the alley, all paying cash.
- **Combat** — mouse-aimed pistol, armed rivals, car explosions, and a garage that repairs your ride for $50.
- **HUD and save** — cash, health, ammo, speed, wanted stars and minimap on screen; progress saves to localStorage automatically.

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrows | Walk and drive |
| Shift | Sprint |
| E | Enter / exit a car, buy ammo at Ammo Mart |
| Mouse + click | Aim and shoot (on foot) |
| R | Reload |
| Enter | Start the next job |
| P / Esc | Pause |
| M | Mute |

## Play

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Open the served page in a desktop browser. No build step, no network requests, no install.

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/game, out/screenshots, out/dossier.json
```

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, staged by `game/src/shots.js` through `?shot=start|drive|chase|mission&seed=1` — the same simulation a player gets, driven by an autopilot. They are retaken with the Playwright script in `../shot-tools/` (kept outside this repo).

## License

MIT
