# @fforw/medium -- design

A local CLI that publishes demos, tools and paintings to fforw.de. The
files themselves live under `~/static/` on the server. Ghost only holds
the generated list pages (`/demos/`, `/tools/`, `/paintings/`, ...),
which medium creates and updates through the Ghost Admin API.

## Principles

* **Files in `/static/`, lists in Ghost.** There are no Ghost posts per
  item. Each item is a folder or image under `~/static/`, and each
  category is one Ghost page that lists its items as cards.
* **The local data file is the source of truth.** Ghost only shows it.
  Every push regenerates the affected list pages completely, so any edit
  made to them in Ghost's editor is overwritten.
* **One source per field.** Demo titles and descriptions come from the
  demo's README and are re-read on every deploy. Paintings get theirs
  from a sidecar `.md`. Everything else lives in the data file.
* **Descriptions are used as-is.** The Markdown is rendered to HTML and
  put on the card unchanged. Keeping it short, or linking to a blog post
  for more, is up to the author.

## Configuration

`~/.config/medium/config.json` is per machine, `chmod 600` and not
committed:

```json
{
    "ghost": {
        "url": "https://fforw.de",
        "adminKey": "<id>:<secret>"
    },
    "static": {
        "rsync": "myweb:static",
        "url": "https://fforw.de/static"
    },
    "dataFile": "~/Documents/fforw/medium-data.json"
}
```

## Data file

Plain JSON, written by medium and editable by hand. It lives wherever is
convenient (backed up by Time Machine), and every push also copies it to
the server (`~/medium/data.json`, outside the public static tree) so the
nightly server backup holds an offsite copy.

```json
{
    "categories": [
        {
            "slug": "demos",
            "title": "Demos",
            "intro": "Markdown shown above the cards",
            "page": "demos"
        }
    ],
    "items": [
        {
            "slug": "gen-59",
            "category": "demos",
            "topics": ["generative"],
            "title": "Gen 59",
            "description": "Markdown",
            "repo": "https://github.com/fforw/gen-59",
            "variants": ["b", "c"],
            "created": "2019-03-02",
            "updated": "2026-10-14",
            "hidden": false
        }
    ]
}
```

* `page` is the Ghost page slug that the category renders to. Splitting
  demos into topic pages later only changes the data, not the tool.
* Items reference their category by slug, so moving an item is a
  one-field edit.
* `hidden` keeps an item deployed but off the list pages.

## Server layout

```
~/static/demo/<slug>/              build output of a demo or tool
~/static/demo/<slug>-<variant>/    a variant's build
~/static/thumbs/<slug>.jpg         card screenshot or painting thumbnail
~/static/paintings/<slug>.jpg      full-size painting
~/medium/data.json                 offsite copy of the data file
```

Variants are siblings rather than sub-folders because the demo deploy
runs `rsync --delete` on `demo/<slug>/`, which would wipe nested
variants. The screenshots are kept outside the demo folders for the
same reason.

## Demos

### Inputs from the demo repo

* **The slug:** the repo folder name.
* **The title:** the README's first `# heading`, or the slug if there
  is none.
* **The description:** the README body, minus the frontmatter and the
  title heading.
* **The GitHub link:** `git remote get-url origin`.
* **Optional flat frontmatter** in `README.md`, which GitHub shows as a
  table:

  ```markdown
  ---
  category: tools
  topics: [generative, webgl]
  shot-delay: 2000
  shot-click: true
  ---
  ```

  `category` defaults to `demos`.

### `synch.sh [variant] [--pick]`

The script that simple-starter (and every demo made from it) ships
becomes a thin wrapper:

```bash
#!/bin/bash
set -e
pnpm run build
medium deploy "$@"
```

`medium deploy` runs in the repo directory and does the following:

1. Rsyncs `docs/` to `demo/<slug>/`, or to `demo/<slug>-<variant>/` for
   a variant, with `--delete --exclude=.git --exclude=*.blend` as today.
2. Takes a screenshot of the deployed page with Playwright. Without
   `--pick`, it waits `shot-delay` (and clicks first if `shot-click` is
   set), then saves the frame. With `--pick`, it opens a visible browser
   and saves the frame when you press a key, so you can choose the frame
   from a generative demo by hand. Variants don't get screenshots.
3. Rsyncs the screenshot to `thumbs/<slug>.jpg`.
4. Reads the README and updates the item in the data file, adding the
   variant name if it is new. It sets `created` on the first deploy and
   `updated` on every one.
5. Pushes the item's category page to Ghost.

## Paintings

Each painting is an image with a sidecar Markdown file of the same name:

```
some-painting.jpg
some-painting.md     # frontmatter (title, date, topics) + description
```

`medium add <image>` reads both and does the following:

1. Uploads the image to `paintings/` and a generated thumbnail to
   `thumbs/`.
2. Upserts the item in the `paintings` category.
3. Pushes the page.

## Commands

| Command | Does |
|---|---|
| `medium deploy [variant] [--pick]` | Deploys the demo in the current repo, as described above |
| `medium add <image>...` | Publishes paintings |
| `medium shot <slug> [--pick]` | Retakes the screenshot of a deployed demo |
| `medium push [category...]` / `--all` | Regenerates list pages from the data file |
| `medium list [category]` | Shows items and their state |

Hiding items, moving them and editing categories are done in the data
file by hand, followed by a `medium push`.

## Rendering list pages

* Each category page is a single Ghost HTML card (Lexical `html` node),
  so Ghost doesn't reformat the markup. The CSS is inline and scoped to
  the gallery container.
* Each card shows the screenshot, the title linking to the demo, the
  rendered description, the variant names as links, and the GitHub
  link.
* The markup and CSS from the old `tools/demos/gallery.mjs`
  (fforw-recovery `a99666a`) are a starting point.
* When a page is updated, medium sends the page's current `updated_at`
  back, as Ghost requires. It only ever touches the pages named in
  `categories[].page`.

## Implementation

* Node, ESM, TypeScript, built with pnpm.
* Dependencies: `@tryghost/admin-api`, `playwright`, `gray-matter`,
  `marked`, and `sharp` for the painting thumbnails.
* Uses the system `rsync` and `ssh`.

## Open questions

* **Installing medium:** `pnpm add -g @fforw/medium` from npm, or
  `pnpm link --global` from a local checkout. `synch.sh` just expects
  `medium` on the `PATH`.
* **Migrating the existing demos:** seed the data file from the old
  `tools/demos/demos.json` (descriptions, categories, hidden flags) and
  the screenshots in the recovery archive, instead of redeploying about
  100 repos.
* **Old-style variants:** today `synch.sh <name>` replaces the whole
  slug. Existing alternate deployments need to be mapped either to a
  parent item plus a variant, or to items of their own.
* **Painting image sizes:** the maximum size of the full image and the
  thumbnail size.
