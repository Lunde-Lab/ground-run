#!/bin/bash
# Release: bump the service-worker cache version so installed apps drop the old cache,
# and bump the app version (1.N -> 1.N+1) + date shown at the bottom of the app.
cd "$(dirname "$0")/.." || exit 1
V=$(date +%Y%m%d%H%M%S) && sed -i "s/^const VERSION = .*/const VERSION = \"$V\";/" sw.js && echo "sw.js VERSION = $V"
OLD=$(sed -n 's/^  var APP_VER = "\([0-9]*\)\.\([0-9]*\)".*/\1 \2/p' index.html)
[ -n "$OLD" ] || { echo "APP_VER not found in index.html"; exit 1; }
set -- $OLD; NEW="$1.$(($2 + 1))"; D=$(date +%Y-%m-%d)
sed -i "s/^  var APP_VER = .*/  var APP_VER = \"$NEW\", APP_DATE = \"$D\";/" index.html && echo "App version $NEW ($D)"
