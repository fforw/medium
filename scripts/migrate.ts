#!/usr/bin/env node
// One-off: seeds the data file and the server's thumbs/ from the
// fforw-recovery archive, instead of redeploying about 100 repos.
//
//   node scripts/migrate.ts [--recovery <dir>] [--dry-run]
//
// --dry-run prints the data file instead of writing it and uploads nothing.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { loadConfig } from "../src/config.ts";
import { saveData, type Category, type Data, type Item, type Page } from "../src/data.ts";
import { ensureDirs, run } from "../src/remote.ts";

const COMMIT = "a99666a";

interface OldDemo
{
    slug: string;
    title: string;
    year: number;
    category: string;
    description: string;
    github: string | null;
    hidden?: boolean;
    group?: string;
}

const PAGES: Page[] = [
    { slug: "demos", title: "Demos", intro: "" },
    { slug: "tools", title: "Tools", intro: "" },
    { slug: "paintings", title: "Paintings", intro: "" },
];

// Titles and intros as on the old pages, from gallery.mjs
const CATEGORIES: Category[] = [
    { slug: "generative", title: "Generative art", intro: "Each run comes out different. Most of them paint a new one on click.", page: "demos" },
    { slug: "realtime", title: "Realtime & shaders", intro: "GLSL shaders, raymarching and 3D: closer to the old demoscene than to generative art.", page: "demos" },
    { slug: "games", title: "Games", intro: "Playable prototypes.", page: "demos" },
    { slug: "experiments", title: "Experiments & tools", intro: "Algorithm tests, library examples and small helpers.", page: "demos" },
    { slug: "tools", title: "Tools", intro: "", page: "tools" },
    { slug: "paintings", title: "Paintings", intro: "", page: "paintings" },
];

function gitShow(dir: string, file: string): string
{
    return execFileSync("git", ["show", `${COMMIT}:${file}`], { cwd: dir, encoding: "utf8", maxBuffer: 64 << 20 });
}

export function migrate(demos: OldDemo[], dates: Map<string, string>): Data
{
    const items = new Map<string, Item>();
    for (const d of demos.filter(d => !d.group))
    {
        if (!CATEGORIES.some(c => c.slug === d.category))
        {
            throw new Error(`${d.slug}: unknown category ${d.category}`);
        }
        const created = dates.get(d.slug) ?? `${d.year}-01-01`;
        items.set(d.slug, {
            slug: d.slug,
            category: d.category,
            topics: [],
            title: d.title,
            description: d.description,
            repo: d.github,
            variants: [],
            created,
            updated: created,
            ...(d.hidden ? { hidden: true } : {}),
        });
    }
    for (const v of demos.filter(d => d.group))
    {
        const parent = items.get(v.group!);
        if (!parent)
        {
            throw new Error(`${v.slug}: no parent ${v.group}`);
        }
        parent.variants.push({
            slug: v.slug,
            title: v.title,
            description: v.description,
            ...(v.hidden ? { hidden: true } : {}),
        });
    }
    return { pages: PAGES, categories: CATEGORIES, items: [...items.values()] };
}

async function main()
{
    const { values } = parseArgs({
        options: {
            recovery: { type: "string", default: path.join(os.homedir(), "Projects", "fforw-recovery") },
            "dry-run": { type: "boolean", default: false },
        },
    });
    const dir = values.recovery;
    const demos: OldDemo[] = JSON.parse(gitShow(dir, "tools/demos/demos.json"));
    const inventory: { slug: string, date?: string }[] = JSON.parse(gitShow(dir, "tools/demos/inventory.json"));
    const dates = new Map(inventory.filter(i => i.date).map(i => [i.slug, i.date!]));
    const data = migrate(demos, dates);

    const variants = data.items.reduce((n, i) => n + i.variants.length, 0);
    console.error(`${data.items.length} items, ${variants} variants`);
    if (values["dry-run"])
    {
        console.log(JSON.stringify(data, null, 4));
        return;
    }

    const config = loadConfig();
    // An empty file, as left by touch, has nothing to lose
    if (fs.existsSync(config.dataFile) && fs.statSync(config.dataFile).size > 0)
    {
        throw new Error(`${config.dataFile} already exists, not overwriting it`);
    }
    saveData(config.dataFile, data);
    console.error(`wrote ${config.dataFile}`);

    // No --delete: thumbs/ is shared with the paintings
    const shots = path.join(dir, "build", "demo-shots");
    await ensureDirs(config);
    await run("rsync", ["-rtz", "--include=*.jpg", "--exclude=*", shots + "/", `${config.static.rsync}/thumbs/`]);
    console.error("uploaded the screenshots, now run: medium push --all");
}

main().catch(e => {
    console.error(`migrate: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
});
