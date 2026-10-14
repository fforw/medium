# Medium

A CLI that publishes pages based on static file contents on a Ghost
based blog: the files go to the configured static directory on the
server by rsync, and the list pages are regenerated in Ghost through
the Admin API. See [design.md](design.md) for how it works.

## Setup

    pnpm install
    ln -s "$PWD/src/cli.ts" ~/bin/medium    # any folder on the PATH

The sources run directly with Node 24's type stripping, so changes are
live; `pnpm typecheck` checks the types. `rsync` and `ssh` must be
installed, `ffmpeg` too for videos.

## Configuration

`~/.config/medium/config.json` holds the per-machine settings. It
contains the Admin API key, so make it readable only by you
(`chmod 600`).

```json
{
    "ghost": {
        "url": "https://blog.example.com",
        "adminKey": "<24 hex>:<64 hex>"
    },
    "static": {
        "rsync": "myhost:static",
        "url": "https://blog.example.com/static"
    },
    "dataFile": "~/Documents/medium-data.json"
}
```

* `ghost.url`: the blog, without a trailing slash.
* `ghost.adminKey`: the Admin API key of a custom integration (Ghost
  Admin, Settings, Integrations). Not the Content API key.
* `static.rsync`: where the files go, as `host:path`. The host is an
  ssh host, e.g. an alias from `~/.ssh/config`; the path is relative
  to your home directory there. medium creates `demo/`, `thumbs/`,
  `paintings/` and `videos/` below it.
* `static.url`: the public URL of that same directory.
* `dataFile`: where the data file lives (`~` is allowed). Every push
  also copies it to `~/medium/data.json` on the same host, as an
  offsite backup.

## Data file

The data file is the source of truth for what is published; Ghost only
shows it. It is JSON, written by medium and meant to be edited by hand
as well. Start with an empty file (`touch` it) and add your pages and
categories:

```json
{
    "pages": [
        { "slug": "demos", "title": "Demos", "intro": "Markdown above everything" },
        { "slug": "paintings", "title": "Paintings" }
    ],
    "categories": [
        { "slug": "generative", "title": "Generative", "intro": "Markdown above the cards", "page": "demos" },
        { "slug": "realtime", "title": "Realtime", "page": "demos" },
        { "slug": "paintings", "title": "Paintings", "page": "paintings" }
    ],
    "items": []
}
```

* **`pages`** are Ghost pages, by slug. medium only ever touches the
  pages listed here, and rewrites them completely on every push, so
  edits made in Ghost's editor are lost. A page missing in Ghost is
  created as a draft, to be published there once.
* **`categories`** are the sections of a page, in this order. Several
  categories can share a page; a page with only one shows its cards
  without a heading. Moving a category to another page is a change of
  its `page`.
* **`items`** are filled in by `medium deploy` and `medium add`. Each
  has a `slug`, `category`, `title`, `description` (Markdown),
  `topics`, `created` and `updated` dates, and, depending on the kind:
  * demos: `repo` and `variants`, the other deployments listed on the
    demo's card. A variant's `title` is its link text and its
    `description` the tooltip; both are filled in by hand.
  * paintings and videos: `ext`, the file's extension, `focus` for the
    thumbnail crop and, for videos, `frame`.

  Setting `"hidden": true` on an item, or on a variant, keeps it
  deployed but off the page. Changing an item's `category` moves it.

New demos name their category in their `package.json` (see
design.md). `medium add` puts new paintings into the `paintings`
category and new videos into `animations`, so the data file needs
those categories before the first one is added.

After editing the data file by hand, run `medium push` for the pages
you changed, or `medium push --all`.

## Usage

    medium deploy [variant] [--slug <slug>] [--pick]   deploy the demo in this repo
    medium add <file>...                               publish paintings and videos
    medium shot <slug> [--pick]                        retake a demo's screenshot
    medium push <page-or-category>... | --all          regenerate list pages
    medium list [category]                             show items and their state

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
