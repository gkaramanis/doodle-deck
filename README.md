# Doodle Deck

A Steam screensaver that draws the Steam Deck in wobbly hand-drawn outlines. Each Deck is drawn stroke by stroke in a random order, held while its lines boil, then wiped and drawn again at a new place, size and angle, so nothing stays put long enough to burn in.

Steam loads custom screensavers from folders under `~/.steam/root/config/uioverrides/screensavers/`. This one is `doodledeck`. The folder name must stay lowercase, for the reason given in `build.sh`.

## Install on a Steam Deck

```sh
./build.sh deck <host>    # build, then copy to the Deck over ssh
```

Or build the zip with `./build.sh`, copy `build/doodledeck` into the screensavers folder in Desktop Mode, and pick it under Settings → Customization → Screensaver.

## Options

Edit `config.js` on the Deck: line colour, background, wobble, boil rate, line width and the draw, hold and wipe times. An existing `config.js` is kept when you redeploy.

## Preview

Open `demo.html` in a browser to try the options with sliders and copy the result as a `config.js`. It runs the screensaver's own `src/main.js`.

Or open `src/index.html`. Query parameters override `config.js`, so `index.html?wobble=2&boilRate=6&holdSeconds=3` shows a heavier, slower boil on a short loop.

## Views

The front, back and top are drawn by hand in `src/main.js`, with positions and sizes measured from Valve's reference drawing. Pick any mix with `views` in `config.js`. Views come in a random order, never the same one twice in a row.

`tools/extract_cad.py` turns Valve's drawing into `tools/ghost.js`, the outlines the measurements were taken from. Neither the screensaver nor the demo loads it. To regenerate it, download `steamdeck_2d_20220202.pdf` from Valve's repo and run:

```sh
pdftocairo -svg -f 1 -l 1 steamdeck_2d_20220202.pdf page1.svg
pdftocairo -svg -f 2 -l 2 steamdeck_2d_20220202.pdf page2.svg
python3 tools/extract_cad.py page1.svg page2.svg
```

## Credit

The views' measurements and `tools/ghost.js` come from the [Steam Deck CAD files](https://gitlab.steamos.cloud/SteamHardware/SteamDeck) by Valve Corporation, under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). This project shares them under the same licence and isn't made or endorsed by Valve.
