# The Hollow Loop

A third-person dungeon crawler with auto-attacking combat, an interconnected dungeon
that circles back on itself, permanent boss kills, and Megabonk-style leveling: embers fill a level bar, and each
level offers a choice of boons or blade upgrades that last until you fall. Runs in the browser with three.js (r128 from cdnjs;
the FBX loader and its helpers are vendored in `js/vendor/`). No build step.

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
  data/               tuning only: hero/enemy stats and ember drops, XP curve, weapon upgrades, boon list
  render/             renderer, procedural textures and themes, orbit camera, line-of-sight shader,
                      billboard sprite system (sprites.js) and placeholder character art (placeholders.js),
                      the 3D hero knight (heroModel.js)
  vendor/             three.js r128 example scripts (FBXLoader, fflate, SkeletonUtils), unmodified, MIT
  world/              geometry + collision, room builder, props, and region scripts (region1.js)
  entities/           hero, enemies (one module per type + shared registry/AI helpers)
  systems/            combat, pickups (embers, flasks), leveling (XP bar, run state), boons, world rules (death ends the run), interactables
  ui/                 HUD, damage numbers, messages, pause menu, level-up window
  input/              keyboard/mouse/touch, gamepad
```

### Where to change things

- **Balance**: `js/data/tuning.js` (including `XP`, the level curve, and each enemy's `embers`),
  `js/data/weapons.js`, `js/data/boons.js`. How often a weapon card appears: `WEAPON_CHANCE`
  in `js/ui/levelup.js`.
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

### The 3D hero

The hero is a skinned 3D knight: `assets/models/knight.fbx` (a Tripo mesh on a Mixamo skeleton, with the
animation clips baked into the file) and a 512px albedo texture, `assets/models/knight_albedo.jpg`.
`render/heroModel.js` loads it, cuts each source clip down to the window the game uses (`WINDOWS` at the top of
that file, in seconds), and blends them by body half so the sword swing and the flask play on the upper body
while the legs keep running. `entities/hero.js` only feeds it speed, hurt and death state and calls
`playSwing()`, `playDive()` and `playDrink()` when those actions start. The model has no weapon, so the sword
(length and glow follow the blade upgrade level) and the flask are small props parented to the right-hand bone.

Source clips: `wait` (idle), `look_around` (plays after ~7 s of standing still), `walk`, `run`, the one-handed
sword swing, `drinking a potion`, `dive` (the dash) and `fall` (death). There is no hit-reaction clip: being hit
is a red flash plus a lean back. To swap in new animations, export the knight from Mixamo again with the clips
included, replace `knight.fbx`, and adjust `WINDOWS` (clips are matched by a lower-case name prefix).

If the model fails to load, the billboard sprite below stands in for it.

### 2.5D characters

The level is 3D with pixel-art textures; every enemy (and the hero, until the 3D knight has loaded) is a billboarded
sprite (`render/sprites.js`). A sprite actor is an upright quad that turns to face the
camera, flips left/right by which way the character faces on screen, and has a blob
shadow. Frames are painted by a `draw(ctx, A)` function. The hero's fallback uses a real sprite sheet
(`assets/sprites/knight.png`, wired up in `render/knight.js`) with drawn down/left/up/right
views for idle, walk, attack, dash, drink, hurt and death. It is cut from the master sheet
`assets/source/knight_master.png` by `python3 tools/cut_knight.py`. Enemies still use procedural placeholders
(`render/placeholders.js`); give them sheets the same way. Keep sprites at 16 px per world unit so their pixels
match the wall textures. The hero faces where they walk (`hero.facing`), independent of
the camera. Camera tuning (distance, pitch range, FOV) is `CAM` in `data/tuning.js`.
