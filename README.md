# Medium

A CLI that publishes demos, tools and paintings to fforw.de: the files
go to the server's `static/` tree by rsync, and the list pages are
regenerated in Ghost through the Admin API. See [design.md](design.md)
for how it works.

## Setup

    pnpm install
    pnpm link --global

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
