#!/bin/sh
# Build the zip to upload to the Chrome Web Store. Run from the repo root.
set -e
v=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
mkdir -p dist
rm -f "dist/counterpoint-$v.zip"
zip -qr "dist/counterpoint-$v.zip" manifest.json background.js extract.js panel.html panel.css panel.js prompt.js providers.js icons LICENSE PRIVACY.md
echo "dist/counterpoint-$v.zip"
