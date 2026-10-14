#!/bin/bash
# Builds "Medium Add.app" from medium-add.applescript and registers it
# as an Open With choice for images and videos in Finder.
#
#   mac/install.sh [folder]     (default: ~/Applications)
set -e

dir=$(cd "$(dirname "$0")" && pwd)
dest="${1:-$HOME/Applications}"
app="$dest/Medium Add.app"

mkdir -p "$dest"
rm -rf "$app"
osacompile -o "$app" "$dir/medium-add.applescript"

# osacompile declares that the app opens any file, and Finder doesn't
# offer such apps under Open With. Declare images and videos instead,
# ranked Alternate so the app never becomes their default.
plutil -replace CFBundleDocumentTypes -json '[{
    "CFBundleTypeName": "Image or video",
    "CFBundleTypeRole": "Viewer",
    "LSItemContentTypes": ["public.image", "public.movie"],
    "LSHandlerRank": "Alternate"
}]' "$app/Contents/Info.plist"
plutil -replace CFBundleIdentifier -string "de.fforw.medium-add" "$app/Contents/Info.plist"

# Editing Info.plist breaks the signature, and macOS would call the app damaged
codesign --force --sign - "$app"

/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$app"
echo "installed $app"
