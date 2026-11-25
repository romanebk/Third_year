# Accessibility

Owner: Alexis (client). Status: implemented for the first defense; the plan below is what is left.

This page lists what players with disabilities need in a fast shoot'em up like R-Type, what the
client already provides, and what we still plan to deliver for the final defense.

## 1. Needs per category

| Category | Typical needs in a shoot'em up |
|---|---|
| **Motor** (limited hand mobility, one hand, tremor, slow reactions) | Choose any key for any action; no key combination to press at once; no rapid tapping required; support for other devices (gamepad, adapted controllers); a slower or easier game. |
| **Visual** (low vision, color blindness) | Players and dangers recognizable without relying on color only; readable, high contrast text; bigger sprites or text; enemy shots that stand out from the background. |
| **Audio** (deaf, hard of hearing) | No information given by sound only; separate volumes for music and effects; visual cues for important sounds (hit, explosion, enemy fire). |
| **Cognitive** (attention, memory, photosensitive epilepsy) | Simple, consistent menus; on-screen help; settings that are saved; no forced flashing; the possibility to pause; an easier difficulty. |

## 2. What works now (first defense)

- **Key rebinding** (motor): in *Settings*, every action (move up/down/left/right, fire, pause) can
  be bound to any key. Keys are stored as physical positions (scancodes), so the layout works on
  QWERTY and AZERTY keyboards. If a key is already used, the two actions swap their keys, so no
  action is ever left without a key. *Reset keys* restores the defaults.
- **Settings are saved** (cognitive, motor) in `client.cfg` and reloaded at each launch: the player
  configures the game once.
- **Separate volumes** for music and sound effects (audio, cognitive): music can be turned down to
  hear the effects better, or the other way around.
- **Players identified without color only** (visual): each ship has its own color *and* a `P1` to
  `P4` label above it; the HUD repeats the player number next to each score.
- **Readable text** (visual): pixel font with a black outline, so it stays readable over the stars
  and the sprites.
- **Resizable window and fullscreen** (visual, motor): the window can be enlarged (drag a border,
  maximize, or F11 for fullscreen) and the whole game scales with it, keeping its proportions, so
  small sprites and text become bigger on a bigger screen. The mouse follows the scaling.
- **Menus with the keyboard or the mouse** (motor, cognitive): the same simple list in every menu,
  with a help line at the bottom of the screen.
- **Pause** (cognitive, motor): the pause key opens a menu at any time.
- **One key to fire, no combinations** (motor): the fire action is a single key. A tap fires the normal
  shot; holding the same key charges the beam, so the player never has to press two keys at once.
  Rapid tapping is only needed for a stream of normal shots: a hold-to-auto-fire option is planned
  (§3).
- **Difficulty** (motor, cognitive): *Settings* offers Easy / Normal / Hard for the solo game. It
  changes numbers only: enemy and boss hit points (x0.5 / x1 / x1.5), enemy bullet speed
  (x0.75 / x1 / x1.25), the delay between enemy shots (x1.5 / x1 / x0.75), the starting lives
  (5 / 3 / 2) and the invincibility after a respawn (3 s / 2 s / 1.5 s). The choice is saved in
  `client.cfg`. In a network game the room's own `--difficulty` applies and the client cannot
  change it (`docs/documentation_du_projet/game-design.md` §12).
- **Important sounds also shown on screen** (audio): the boss arrival alarm comes with a `BOSS`
  health bar and an `ENRAGED` label in phase 2; pickups show their letter (`P`, `S`) above the
  sprite; the score, lives and beam gauge are always visible.
- **No accidental skip** (cognitive): the game-over screen ignores keys for a short time after the
  game ends, so a player still pressing fire does not skip the scores.

### Blind players (added after the first defense)

- **A voice reads the menus**: each time the selection changes (keys or mouse), the voice says the
  line ("Solo game", "Music 50 percent", "Fire Space"). Entering a screen says its name first
  ("Settings", "Waiting room"). Letters typed in the *Multiplayer* fields are said one by one.
  *Settings > Voice* turns it off; it is **on by default**, since a blind player could not find the
  option to turn it on.
- **Summary key** (Tab by default, rebindable like the others): the voice says the score, the lives,
  the speed and power levels, the level or wave, and the boss health ("boss 42 percent" or
  "no boss").
- **Position sounds**: a new enemy plays a short beep and an explosion its sound, placed **left or
  right** of our ship (stereo pan) and **higher-pitched when it is higher** on the screen.
- **One sound per event**: shot, explosion, enemy, ship destroyed (then the voice says the lives
  left), each bonus, boss arrival, boss hit, boss phase 2, boss destroyed, victory (rising notes),
  game over (falling notes). The messages written on screen ("WARNING: THE BOSS IS COMING",
  "WAVE 4", "BOSS WAVE 5") are read aloud too.
- **How the voice is made**: one file per word in `client/assets/voice/` (217 words, numbers 0 to
  100, letters), played one after the other; bigger numbers use "thousand" and "hundred", unknown
  words (a player name) are spelled. The files are generated by `scripts/make_sounds.sh` with
  **Flite** (free speech synthesis of Carnegie Mellon University, BSD-like license) through ffmpeg:
  nothing is downloaded, so there is no license problem. A test checks that every word the client
  says has its file.

## 3. Plan for the final defense

| Feature | Category | Owner |
|---|---|---|
| Gamepad support, rebindable like the keyboard | Motor | Client |
| Auto-fire option (hold the fire key to shoot continuously, instead of the charge beam) | Motor | Client |
| Difficulty chosen by the player in a network game (needs the lobby/RFC to carry it) | Motor, cognitive | Network + Client |
| Colorblind-safe palette and high contrast mode for enemy shots | Visual | Client |
| Text size and sprite size options | Visual | Client |
| Sound captions: short text with the direction of important sounds | Audio | Client |
| "Reduce flashing" option (no blinking, softer explosions) and no screen shake | Cognitive, photosensitivity | Client |
