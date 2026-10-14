# Medium

A CLI that publishes demos, tools and paintings to fforw.de: the files
go to the server's `static/` tree by rsync, and the list pages are
regenerated in Ghost through the Admin API. See [design.md](design.md)
for how it works.

## Setup

    pnpm install
    ln -s "$PWD/src/cli.ts" ~/bin/medium    # any folder on the PATH

Then create `~/.config/medium/config.json` (`chmod 600`) as described
in design.md. The sources run directly with Node 24's type stripping,
so changes are live; `pnpm typecheck` checks the types.

## Usage

    medium deploy [variant] [--slug <slug>] [--pick]   deploy the demo in this repo
    medium add <image>...                              publish paintings
    medium shot <slug> [--pick]                        retake a demo's screenshot
    medium push <page-or-category>... | --all          regenerate list pages
    medium list [category]                             show items and their state

The data file is seeded once from the old archive with
`node scripts/migrate.ts` (`--dry-run` to look first).

## Adding from Finder

`mac/install.sh` builds a small "Medium Add" app from
`mac/medium-add.applescript` and installs it in `~/Applications` (or
the folder given as its argument). The app opens a Terminal window and
runs `medium add` there, so its prompts get an interactive shell.

    mac/install.sh

Then, in Finder:

1. Right-click an image or video and choose **Open With**. "Medium
   Add" is listed for images and videos, but never as their default,
   so double-clicking a file still opens it as before.
2. If it isn't listed yet, choose **Open With → Other…**, go to
   `~/Applications` (⇧⌘H, then Applications) and pick **Medium Add**.
   Leave **Always Open With** unticked: it would make that one file
   always open with medium. After that it shows up in the list. A
   Finder restart (⌥-right-click its Dock icon → Relaunch) helps if
   it doesn't.
3. The first time, macOS asks whether Medium Add may control Terminal;
   allow it.

Several files selected together go to one `medium add`, which pushes
the page once at the end. Dropping files on the app's icon, e.g. in
the Dock, works the same way.

Rerun `mac/install.sh` after changing the script. Compiling it by
other means loses the image and video file types, and the app drops
out of the Open With list again.
