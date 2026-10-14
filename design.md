# @fforw/medium -- design

A local CLI that publishes demos, tools and paintings to fforw.de. The
files themselves live under `~/static/` on the server. Ghost only holds
the generated list pages (`/demos/`, `/tools/`, `/paintings/`, ...),
which medium creates and updates through the Ghost Admin API.

## Principles

* **Files in `/static/`, lists in Ghost.** There are no Ghost posts per
  item. Each item is a folder or image under `~/static/`, and each list
  page is one Ghost page that shows its categories as sections of
  cards.
* **The local data file is the source of truth.** Ghost only shows it.
  Every push regenerates the affected list pages completely, so any edit
  made to them in Ghost's editor is overwritten.
* **One source per field.** Demo titles and descriptions come from the
  demo's README and are re-read on every deploy. Screenshot settings
  come from its `package.json`. Paintings get theirs
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
    "pages": [
        {
            "slug": "demos",
            "title": "Demos",
            "intro": "Markdown shown above the section nav"
        }
    ],
    "categories": [
        {
            "slug": "generative",
            "title": "Generative",
            "intro": "Markdown shown above the section's cards",
            "page": "demos"
        },
        {
            "slug": "realtime",
            "title": "Realtime & shaders",
            "intro": "...",
            "page": "demos"
        }
    ],
    "items": [
        {
            "slug": "gen-59",
            "category": "generative",
            "topics": ["webgl"],
            "title": "Gen 59",
            "description": "Markdown",
            "repo": "https://github.com/fforw/gen-59",
            "variants": [
                { "slug": "g59-err", "title": "err", "description": "..." },
                { "slug": "g59-linear" }
            ],
            "created": "2019-03-02",
            "updated": "2026-10-14",
            "hidden": false
        }
    ]
}
```

* `pages[].slug` is the Ghost page slug. The page's title and intro
  belong to no single section, so they live here.
* `categories[].page` names the page a category renders to. Several
  categories can share a page; each becomes a section on it, in array
  order. Giving a category its own page later only changes the data,
  not the tool.
* Items reference their category by slug, so moving an item, even to
  another page, is a one-field edit.
* `topics` are free tags. Nothing renders them yet; they are kept for
  filtering later.
* `hidden` keeps an item deployed but off the list pages.
* `variants` are other deployments that belong to the item. Each one
  is a flat `demo/<variant slug>/` of its own, but has no card: it
  only shows up as a link on its parent's card. `title` is the link
  text (default: the slug), `description` its tooltip.

## Server layout

```
~/static/demo/<slug>/              build output of a demo, tool or variant
~/static/thumbs/<slug>.jpg         card screenshot or painting thumbnail
~/static/paintings/<slug>.<ext>    full-size painting, as given
~/medium/data.json                 offsite copy of the data file
```

Everything under `demo/` is flat. A variant is a sibling of its parent,
never a sub-folder, because the deploy runs `rsync --delete` on
`demo/<slug>/`, which would wipe nested variants. Which deployment
belongs to which parent is recorded only in the data file. The
screenshots are kept outside the demo folders for the same reason.

## Demos

### Inputs from the demo repo

* **The slug:** the repo folder name, unless `--slug` is given. Some
  existing demos are deployed under other names, and some repos back
  several items.
* **The title:** the README's first `# heading`, or the slug if there
  is none.
* **The description:** the README body, minus the title heading.
* **The GitHub link:** `git remote get-url origin`.
* **An `ff-medium` field in `package.json`** for everything else:

  ```json
  "ff-medium": {
      "category": "generative",
      "topics": ["webgl"],
      "shot": { "delay": 2000, "click": true }
  }
  ```

  Not README frontmatter, because GitHub renders that as a table at
  the top of the repo page. Not `keywords`, because they are flat
  strings meant as npm search tags. npm and pnpm ignore unknown fields,
  and the `ff-` prefix keeps the key clear of other tools. Unknown keys
  inside `ff-medium` are an error, so typos don't go unnoticed.

  `category` and `topics` only seed a new item: the data file is
  authoritative after the first deploy. Later deploys warn when
  `package.json` disagrees with the data file but don't change it.
  There is no default `category`: the first deploy of an unknown item
  fails with a message listing the known categories.

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

1. Rsyncs `docs/` to `demo/<slug>/`, or to `demo/<variant>/` for a
   variant, with `--delete --exclude=.git --exclude=*.blend` as today.
   The variant argument is the full deployment name, as with
   `synch.sh <name>` today. Deploying fails if that name is already an
   item or another item's variant.
2. Takes a screenshot of the deployed page with Playwright, at a
   1200x750 viewport. Without `--pick`, it waits `shot.delay` (and
   clicks first if `shot.click` is set), then saves the frame. With
   `--pick`, it opens a visible browser and saves the frame when you
   press a key, so you can choose the frame from a generative demo by
   hand. Variants don't get screenshots.
3. Rsyncs the screenshot to `thumbs/<slug>.jpg`.
4. Reads the README and `package.json` and updates the item in the
   data file, adding the variant to the item if it is new. It sets `created` on
   the first deploy and `updated` on every one, and warns about any
   `ff-medium` values that disagree with the data file.
5. Pushes the page that the item's category lives on to Ghost.

## Paintings

Each painting is an image with a sidecar Markdown file of the same name:

```
some-painting.png    # any format the browser shows: jpg, png, webp, ...
some-painting.md     # frontmatter (title, date, topics, focus) + description
```

The sidecar is never rendered anywhere, so unlike a demo's README it
can carry frontmatter.

`medium add <image>` reads both and does the following:

1. Uploads the image unchanged to `paintings/<slug>.<ext>`, keeping
   its format and size, and a thumbnail generated with `sharp` to
   `thumbs/<slug>.jpg`.
2. Upserts the item in the `paintings` category.
3. Pushes the page.

### Thumbnails

Thumbnails are 1200x750 JPEGs, the same 16:10 at 2x as the demo
screenshots, so all cards in a grid have the same shape. The painting
is cropped to fill that frame rather than fitted inside it: the card is
a teaser, and the full image is one click away.

* By default, `sharp` picks the region with `fit: "cover"` and
  `position: sharp.strategy.attention`, which favours detail and
  saturation.
* When that guesses wrong, `focus: [x, y]` in the sidecar overrides
  it. `x` and `y` are fractions of the image size, and the crop is
  centred on that point as far as the image edges allow. This is the
  painting counterpart of `--pick` for demos.

## Commands

| Command | Does |
|---|---|
| `medium deploy [variant] [--slug <slug>] [--pick]` | Deploys the demo in the current repo, as described above |
| `medium add <image>...` | Publishes paintings |
| `medium shot <slug> [--pick]` | Retakes the screenshot of a deployed demo |
| `medium push [page-or-category...]` / `--all` | Regenerates list pages from the data file; a category pushes the whole page it lives on |
| `medium list [category]` | Shows items and their state |

Hiding items, moving them and editing pages and categories are done in
the data file by hand, followed by a `medium push`.

## Rendering list pages

* Each list page is a single Ghost HTML card (Lexical `html` node),
  so Ghost doesn't reformat the markup. The CSS is inline and scoped to
  the gallery container.
* The page intro comes first. Each category on the page follows as a
  `<section id="<category slug>">` with its title as heading and its
  intro. A page with more than one section gets an anchor nav below the
  intro; a page with a single category shows no section heading or nav.
* Each card shows the screenshot, the title linking to the demo, the
  rendered description, the variants as links, and the GitHub
  link.
* The markup and CSS from the old `tools/demos/gallery.mjs`
  (fforw-recovery `a99666a`) are a starting point.
* When a page is updated, medium sends the page's current `updated_at`
  back, as Ghost requires. It only ever touches the pages listed in
  `pages`.

## Implementation

* Node, ESM, TypeScript, built with pnpm.
* Dependencies: `@tryghost/admin-api`, `playwright`, `gray-matter`
  for the painting sidecars, `marked`, and `sharp` for the painting
  thumbnails.
* Uses the system `rsync` and `ssh`.
* Installed with `pnpm link --global` from a local checkout, so every
  change is live without publishing to npm. `synch.sh` just expects
  `medium` on the `PATH`.

## Open questions

* **Migrating the existing demos:** seed the data file from the old
  `tools/demos/demos.json` (descriptions, categories, hidden flags) and
  the screenshots in the recovery archive, instead of redeploying about
  100 repos. Its `group` field already names each old variant's parent,
  so those 88 deployments become `variants` entries where they are.
