# Doodle Deck

A screensaver for Steam that sketches the Steam Deck in wobbly, chalky lines. Each Deck appears line by line, wiggles for a while, fades out and is drawn again somewhere else on the screen, from the front, the back or the top. More in the [blog post](https://karaman.is/blog/2026/10/doodle-deck).

![Doodle Deck drawing the front of a Steam Deck in wobbly white lines on black](docs/doodle-deck-front.gif)

## Install on a Steam Deck

1. Switch to Desktop Mode and download **[DoodleDeck.zip](https://github.com/gkaramanis/doodle-deck/releases/latest/download/DoodleDeck.zip)**.
2. Open your home folder in the file manager and press Ctrl+H to show hidden folders.
3. Go to `.steam/root/config/uioverrides/screensavers` (create the `screensavers` folder if it isn't there) and extract the zip into it. You should end up with a `doodledeck` folder.
4. Go back to Gaming Mode and pick **doodledeck** under Settings → Customization → Screensaver.

### Or from your computer over ssh

If ssh is already set up on your Deck, download and unzip **DoodleDeck.zip** on your computer, then run this from the folder you unzipped it in, using your Deck's address in place of `steamdeck.local` if it differs:

```sh
ssh deck@steamdeck.local mkdir -p .steam/root/config/uioverrides/screensavers
scp -r doodledeck deck@steamdeck.local:.steam/root/config/uioverrides/screensavers/
```

Then pick **doodledeck** in Gaming Mode as in step 4.

## Make it yours

Open `config.js` in the `doodledeck` folder with any text editor. You can change the line colour, background, how much the lines wobble, how thick they are, how long each drawing stays, and which views are drawn. Pick the screensaver again for the changes to show.

Want to try settings first? Open the [demo](https://karaman.is/doodle-deck-demo) in a browser, or download this repo and open `demo.html`. Move the sliders, then press **Copy config.js** and paste the result into the file on your Deck.

## Credit

The Deck's proportions come from Valve's [Steam Deck CAD files](https://gitlab.steamos.cloud/SteamHardware/SteamDeck), shared under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Doodle Deck uses the same licence and isn't made or endorsed by Valve.
