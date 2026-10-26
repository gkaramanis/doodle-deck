#!/bin/sh
# Builds the Steam screensaver into build/doodledeck and zips it.
#
#   ./build.sh                 build build/doodledeck and build/DoodleDeck-steam.zip
#   ./build.sh deck <host>     build, then copy it to a Steam Deck over ssh

set -eu
cd "$(dirname "$0")"

# The folder name becomes part of a hostname, which Chromium lowercases, and Steam then
# looks the folder up case-sensitively. A name with capitals fails with error -105.
name=doodledeck
out=build/$name
rm -rf build
mkdir -p "$out"
cp src/index.html src/main.css src/main.js src/config.js "$out/"

(cd build && zip -qr DoodleDeck-steam.zip "$name")
echo "Built $out and build/DoodleDeck-steam.zip"

if [ "${1:-}" = deck ]; then
    host=${2:?usage: build.sh deck <host>}
    dest=".steam/root/config/uioverrides/screensavers/$name"
    ssh "$host" "mkdir -p ~/$dest"
    scp -q "$out/index.html" "$out/main.css" "$out/main.js" "$host:$dest/"

    # An existing config.js holds the options set on the Deck, so it stays.
    if ! ssh "$host" "test -e ~/$dest/config.js"; then
        scp -q "$out/config.js" "$host:$dest/"
    fi
    echo "Copied to $host:~/$dest. Pick it in Settings > Customization > Screensaver."
fi
