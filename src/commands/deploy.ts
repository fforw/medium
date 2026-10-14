import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Config } from "../config.ts";
import { deploymentOwner, findCategory, findItem, loadData, saveData, today, type Data, type Item } from "../data.ts";
import { pagesFor, pushPages } from "../ghost.ts";
import { backupData, ensureDirs, syncDir, syncFile } from "../remote.ts";
import { demoUrl } from "../render.ts";
import { readRepo, type Manifest } from "../repo.ts";
import { takeShot } from "../shot.ts";

export interface DeployOptions
{
    variant?: string;
    slug?: string;
    pick: boolean;
}

/** Checks that the deployment name is free for this item, and returns the item if it exists */
function checkName(data: Data, slug: string, variant: string | undefined): Item | undefined
{
    const owner = deploymentOwner(data, variant ?? slug);
    if (variant)
    {
        const item = findItem(data, slug);
        if (!item)
        {
            throw new Error(`"${slug}" is not deployed yet, deploy it before its variants`);
        }
        if (owner && (owner.item !== item || !owner.variant))
        {
            throw new Error(owner.variant
                ? `"${variant}" is already a variant of "${owner.item.slug}"`
                : `"${variant}" is already an item`);
        }
        return item;
    }
    if (owner?.variant)
    {
        throw new Error(`"${slug}" is already a variant of "${owner.item.slug}", deploy it as "${owner.item.slug}"'s variant`);
    }
    if (owner?.item.ext)
    {
        throw new Error(`"${slug}" is already a painting`);
    }
    return owner?.item;
}

function newItemCategory(data: Data, manifest: Manifest): string
{
    if (!manifest.category)
    {
        throw new Error(`set "ff-medium.category" in package.json for the first deploy, known: ${data.categories.map(c => c.slug).join(", ")}`);
    }
    return findCategory(data, manifest.category).slug;
}

/** package.json only seeds a new item, so later disagreements are just pointed out */
function warnDisagreements(item: Item, manifest: Manifest)
{
    if (manifest.category && manifest.category !== item.category)
    {
        console.warn(`warning: package.json says category "${manifest.category}", the data file "${item.category}"`);
    }
    if (manifest.topics && manifest.topics.join() !== item.topics.join())
    {
        console.warn(`warning: package.json says topics [${manifest.topics.join(", ")}], the data file [${item.topics.join(", ")}]`);
    }
}

export async function deploy(config: Config, opts: DeployOptions)
{
    const dir = process.cwd();
    const slug = opts.slug ?? path.basename(dir);
    const { variant } = opts;
    const docs = path.join(dir, "docs");
    if (!fs.existsSync(docs))
    {
        throw new Error(`no docs/ in ${dir}, build first`);
    }

    const data = loadData(config.dataFile);
    const info = readRepo(dir);
    info.warnings.forEach(w => console.warn(`warning: ${w}`));
    let item = checkName(data, slug, variant);
    const category = item ? item.category : newItemCategory(data, info.manifest);

    await ensureDirs(config);
    await syncDir(config, docs, `demo/${variant ?? slug}`);

    if (!variant)
    {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "medium-"));
        try
        {
            const file = path.join(tmp, `${slug}.jpg`);
            await takeShot(demoUrl(config, slug), file, info.manifest.shot ?? {}, opts.pick);
            await syncFile(config, file, `thumbs/${slug}.jpg`);
        }
        finally
        {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    }

    const fields = { title: info.title ?? slug, description: info.description, repo: info.repo, updated: today() };
    if (item)
    {
        warnDisagreements(item, info.manifest);
        Object.assign(item, fields);
    }
    else
    {
        item = { slug, category, topics: info.manifest.topics ?? [], variants: [], created: today(), ...fields };
        data.items.push(item);
    }
    if (variant && !item.variants.some(v => v.slug === variant))
    {
        item.variants.push({ slug: variant });
    }
    saveData(config.dataFile, data);

    await pushPages(config, data, pagesFor(data, [category]));
    await backupData(config);
}
