# Doodle Deck

A Steam screensaver that draws the Steam Deck in wobbly hand-drawn outlines. Each Deck is drawn stroke by stroke in a random order, held while its lines boil, then wiped and drawn again at a new place, size and angle, so nothing stays put long enough to burn in.

Steam loads custom screensavers from folders under `~/.steam/root/config/uioverrides/screensavers/`. The folder name must be lowercase, or Steam fails to load it with error -105.

## Install on a Steam Deck

Copy the `src` folder into the screensavers folder as `doodledeck`, then pick it under Settings → Customization → Screensaver. Over ssh:

```sh
ssh deck@<host> mkdir -p .steam/root/config/uioverrides/screensavers
scp -r src deck@<host>:.steam/root/config/uioverrides/screensavers/doodledeck
```

## Options

Edit `config.js` on the Deck to set the line colour, background, wobble, boil rate, line width and the draw, hold and wipe times.

## Preview

Open `demo.html` in a browser to try the options with sliders and copy the result as a `config.js`. It runs the screensaver's own `src/main.js`.

Or open `src/index.html`. Query parameters override `config.js`, so `index.html?wobble=2&boilRate=6&holdSeconds=3` shows a heavier, slower boil on a short loop.

## Views

The front, back and top are drawn by hand in `src/main.js`, with positions and sizes measured from Valve's reference drawing. Pick any mix with `views` in `config.js`. Views come in a random order, never the same one twice in a row.

## Credit

The views' measurements come from the [Steam Deck CAD files](https://gitlab.steamos.cloud/SteamHardware/SteamDeck) by Valve Corporation, under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). This project shares them under the same licence and isn't made or endorsed by Valve.
