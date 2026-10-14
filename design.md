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
  come from its `package.json`. Paintings have no repo, so `medium add`
  asks for theirs and stores them in the data file, like everything
  else.
* **Descriptions are used as-is.** The Markdown is rendered to HTML and
  put on the card unchanged. Keeping it short, or linking to a blog post
  for more, is up to the author.

## Configuration

`~/.config/medium/config.json` is per machine, `chmod 600` and not
committed. `medium init` writes it from prompts:

```json
{
    "ghost": {
        "url": "https://fforw.de",
        "adminKey": "<id>:<secret>"
    },
    "static": {
        "rsync": "myweb:static",
        "url": "https://fforw.de/static",
        "folders": {
            "images": "paintings"
        }
    },
    "dataFile": "~/Documents/fforw/medium-data.json",
    "starter": {
        "repo": "https://github.com/fforw/simple-starter",
        "placeholders": [
            "Simple Starter",
            "Simple TypeScript build starter for simple, client-only demos",
            "Simple JS build starter for simple, client-only demos"
        ]
    },
    "categories": {
        "images": "paintings",
        "videos": "animations"
    }
}
```

`starter` names the template demo repos are made from, and the text
in its READMEs that a demo should have replaced; deploy warns about
both (see Demos). `categories` names the categories `medium add` files
new paintings and videos under. Both are optional: without `starter`
there is nothing to warn about, and without `categories` `medium add`
asks for it.

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
* `hidden` keeps an item deployed but off the list pages. A variant
  can be `hidden` too, which leaves it off its parent's card; it is
  still known, so its name can't be deployed again by mistake.
* Paintings also store `ext`, the image's file extension, and `focus`
  when one was given (see Paintings). Videos store `ext`, `frame` and
  `focus` the same way (see Videos).
* `variants` are other deployments that belong to the item. Each one
  is a flat `demo/<variant slug>/` of its own, but has no card: it
  only shows up as a link on its parent's card. The link goes to
  `<static.url>/demo/<variant slug>/`, built from the slug like an
  item's, so no URL is stored. `title` is the link text (default: the
  slug), `description` its tooltip.
* A deploy only adds a new variant as `{ "slug": ... }`, since it has
  no README of its own. A title or tooltip is added by hand in the
  data file, followed by a `medium push`.

## Server layout

```
~/static/demo/<slug>/              build output of a demo, tool or variant
~/static/thumbs/<slug>.jpg         card screenshot, painting or video thumbnail
~/static/paintings/<slug>.<ext>    full-size painting, as given
~/static/videos/<slug>.<ext>       video, as given
~/medium/data.json                 offsite copy of the data file
```

The folder names below the static directory come from the config's
`static.folders`; the defaults are `demo`, `thumbs`, `images` and
`videos`. This layout is fforw.de's, which sets `images` to
`paintings`.

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

  Deploy warns, but still deploys, when the title or body still
  contains the starter template's placeholder text, from the list in
  the config's `starter.placeholders`. That list includes the
  template's older READMEs ("Simple JS build starter for simple,
  client-only demos." ended up on 19 of the old cards).
* **The GitHub link:** `git remote get-url origin`. Deploy warns when
  that is still the config's `starter.repo`, since a demo created
  from the template and never re-pointed would link to the template.
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
  fails with a message listing the known categories. An empty string
  counts as missing, so simple-starter can ship `"category": ""` to
  show where it goes.

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

A painting is just an image file, in any format the browser shows
(jpg, png, webp, ...). Its slug is the file name without the
extension.

`medium add <image>` asks for the painting's details on the terminal,
one prompt per field. Each default is already typed in, to accept
with Enter or edit first, so `toilet-vespa.3.png` only needs the "3"
removed from its title:

| Prompt | Default |
|---|---|
| Title | the slug with dashes and dots as spaces, in title case (`some-painting` becomes "Some Painting") |
| Date | today |
| Topics | none |
| Description | none; one line of Markdown |
| Focus | none, i.e. `sharp`'s guess (see below) |

When the painting is already in the data file, the stored values are
the defaults instead, so re-adding an image to replace it is a matter
of pressing Enter. The answers go into the item in the config's
`categories.images` category (`paintings` here), which also records the image's extension and the focus.

It then does the following:

1. Uploads the image unchanged to `paintings/<slug>.<ext>`, keeping
   its format and size, and a thumbnail generated with `sharp` to
   `thumbs/<slug>.jpg`.
2. Upserts the item in that category.
3. Pushes the page.

With several images, it asks for each one in turn and pushes the page
once at the end.

### Thumbnails

Thumbnails are 1200x750 JPEGs, the same 16:10 at 2x as the demo
screenshots, so all cards in a grid have the same shape. The painting
is cropped to fill that frame rather than fitted inside it: the card is
a teaser, and the full image is one click away.

* By default, `sharp` picks the region with `fit: "cover"` and
  `position: sharp.strategy.attention`, which favours detail and
  saturation.
* When that guesses wrong, a focus point `x, y` given at the prompt
  overrides it. `x` and `y` are fractions of the image size, and the crop is
  centred on that point as far as the image edges allow. This is the
  painting counterpart of `--pick` for demos.

## Videos

A video is a file the browser plays itself, `mp4` or `webm`, uploaded
unchanged to `videos/<slug>.<ext>`. Like a painting, its slug is the
file name without the extension. `medium add` takes videos as well as
images and tells them apart by extension, so the prompts are the
paintings' with one more:

| Prompt | Default |
|---|---|
| Frame | `1`: the second of the video the thumbnail is taken from |

The thumbnail is that frame, grabbed with `ffmpeg` and then cropped
like a painting, so `focus` works the same way. New videos go into
the config's `categories.videos` category (`animations` here), which, like any category, can share a page
with others; the files themselves still live in `videos/`.

### The viewer

A video card doesn't send the reader away to a bare video file or a
separate player page. The list page carries a small inline script, next
to its CSS, that opens the video over the page:

* The card stays a plain link to the video file, marked with
  `data-video` and a play badge over its thumbnail. Without JavaScript, or opened in a new tab, the
  browser's own player shows it.
* A click on such a card opens a `<dialog>` with
  `<video controls autoplay loop playsinline>`. Esc, a close button or
  a click on the backdrop closes it, and closing stops the video.
  `playsinline` keeps mobile Safari from going fullscreen.
* Opening the viewer sets the URL to the card's `#item-<slug>`, so a
  shared link opens that video directly, and Back closes it.

Ghost's editor doesn't run the script, so in the admin the cards only
link to the files; the viewer works on the live page.

Paintings keep linking to the plain image, which the browser already
shows well. Showing them in the viewer too would be a small change
later, but isn't needed.

## Commands

| Command | Does |
|---|---|
| `medium init` | Asks for the config settings and writes the config file, creates the data file if needed, and checks the Ghost key and ssh |
| `medium deploy [variant] [--slug <slug>] [--pick]` | Deploys the demo in the current repo, as described above |
| `medium add <file>...` | Publishes paintings and videos |
| `medium shot <slug> [--pick]` | Retakes the screenshot of a deployed demo, with the `shot` settings of the repo it is run in, if that is the demo's |
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
  link. Painting and video cards link to their file instead, and have
  neither variants nor a GitHub link.
* The markup and CSS from the old `tools/demos/gallery.mjs`
  (fforw-recovery `a99666a`) are a starting point.
* Thumbnail URLs carry `?v=<updated>`, so a new screenshot or painting
  isn't hidden by a cached old one. `medium shot` sets `updated` for
  that reason.
* When a page is updated, medium sends the page's current `updated_at`
  back, as Ghost requires. It only ever touches the pages listed in
  `pages`. A page that doesn't exist in Ghost yet is created as a
  draft, to be published there once.

## Implementation

* Node, ESM, TypeScript, built with pnpm.
* Dependencies: `@tryghost/admin-api`, `playwright`, `marked`, and
  `sharp` for the painting and video thumbnails. The `medium add` prompts use
  Node's own `readline`.
* Uses the system `rsync` and `ssh`, and `ffmpeg` for the video
  frames, which macOS doesn't ship (MacPorts has it). On macOS that rsync is openrsync,
  which has no `--mkpath`, so medium creates the folders it writes to
  with `ssh mkdir -p` first.
* Runs the TypeScript sources directly with Node's type stripping, so
  there is no build step; `pnpm typecheck` runs `tsc`.
* Installed by symlinking `src/cli.ts` from a local checkout into a
  folder on the `PATH` (`ln -s .../src/cli.ts ~/bin/medium`), so every
  change is live without publishing to npm. pnpm 12 has no
  `link --global`, and `pnpm add -g` would put the sources under
  `node_modules`, where Node won't strip types. `synch.sh` just expects
  `medium` on the `PATH`.
