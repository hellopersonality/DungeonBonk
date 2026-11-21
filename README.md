# The Hollow Loop

A third-person dungeon crawler with auto-attacking combat, an interconnected dungeon
that circles back on itself, permanent boss kills, and boons that last until you rest. Runs in the browser with three.js (r128 from cdnjs).
No build step.

## Run locally

ES modules need to be served over HTTP (opening `index.html` from disk won't work):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Add `#debug` to the URL to expose `window.__dbg` (hero, enemies, save, state).

## Deploy to GitHub Pages

Push this folder to a repo (or a subfolder of one), then enable Pages for the branch.
`.nojekyll` is included so GitHub serves every file as-is.

## Controls

| Action | Keyboard / mouse | Controller |
|---|---|---|
| Move | WASD | Left stick |
| Camera (orbit / tilt) | Mouse (click to lock) / arrows | Right stick |
| Dash (i-frames) | Space / Shift | A / RB / RT |
| Interact | E | X |
| Drink flask | Q | Y |
| Pause / settings | Esc | Start |

## Project layout

```
index.html            markup for HUD and menus; loads three.js and js/main.js
css/style.css         all UI styling
js/
  main.js             builds the world, runs the game loop
  core/               no game logic: math helpers, shared state (S), save/settings, synthesized audio
  data/               tuning only: hero/enemy stats, weapon upgrades, boon list
  render/             renderer, procedural textures and themes, orbit camera, line-of-sight shader,
                      billboard sprite system (sprites.js) and placeholder character art (placeholders.js)
  world/              geometry + collision, room builder, props, and region scripts (region1.js)
  entities/           hero, enemies (one module per type + shared registry/AI helpers)
  systems/            combat, pickups (embers, flasks), boons and altars, world rules (rest/save/death), interactables
  ui/                 HUD, damage numbers, messages, pause/crystal menus, forge, altar choice
  input/              keyboard/mouse/touch, gamepad
```

### Where to change things

- **Balance**: `js/data/tuning.js`, `js/data/weapons.js`, `js/data/boons.js`
- **A new enemy type**: add `js/entities/enemies/<name>.js` exporting `make<Name>()` and
  `update<Name>()`, then register the updater in `enemies/registry.js`.
- **A new boon**: add it to `data/boons.js`, then check for it with `has('<id>')` where
  it applies (hero, combat or `systems/boons.js` for effects).
- **A new region**: copy the shape of `world/region1.js`: build rooms and props, spawn
  enemies and items, register interactables, and call `setLevel({...hooks})`.
- **Room look**: themes (wall/floor/ceiling textures) live in `render/textures.js`.

### How the visibility works

`render/visibility.js` builds a top-down wall map from the rooms and solids. Every
level material is patched so each pixel checks sight lines from the hero across that
map; anything the hero can't see fades to black. The camera orbits the hero and never
moves to dodge walls: a clip plane cuts away walls between the camera and the hero
(`render/camera.js`).

### 2.5D characters

The level is 3D with pixel-art textures; the hero and every enemy are billboarded
sprites (`render/sprites.js`). A sprite actor is an upright quad that turns to face the
camera, flips left/right by which way the character faces on screen, and has a blob
shadow. Frames are painted by a `draw(ctx, A)` function. The hero uses a real sprite sheet
(`assets/sprites/knight.png`, wired up in `render/knight.js`) with drawn down/left/up/right
views for idle, walk, attack, dash, drink, hurt and death. It is cut from the master sheet
`assets/source/knight_master.png` by `python3 tools/cut_knight.py`. Enemies still use procedural placeholders
(`render/placeholders.js`); give them sheets the same way. Keep sprites at 16 px per world unit so their pixels
match the wall textures. The hero faces where they walk (`hero.facing`), independent of
the camera. Camera tuning (distance, pitch range, FOV) is `CAM` in `data/tuning.js`.
