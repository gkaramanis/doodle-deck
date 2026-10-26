// Doodle Deck options. Steam has no options screen for custom screensavers, so edit this
// file and pick the screensaver again, or restart Steam.

const DOODLE_CONFIG = {
    // Any CSS colour.
    lineColor: "#f2efe6",
    background: "#000000",

    // How far the lines wobble, from 0 (still) to 3. 1 looks like pencil on paper.
    wobble: 1,

    // How many times a second the drawing is redrawn with new wobble, from 4 to 24.
    boilRate: 10,

    // Seconds to draw a Deck, to hold it, and to wipe it before the next one.
    drawSeconds: 6,
    holdSeconds: 10,
    wipeSeconds: 1.5,

    // Line width in pixels on a 800-pixel-tall screen. It scales with the screen height.
    lineWidth: 2.5,

    // Which views of the Deck to draw: "front", "back" and "top". They come in a random
    // order, never the same one twice in a row.
    views: ["front", "back", "top"],
};
