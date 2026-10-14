import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Config } from "../config.ts";
import { deploymentOwner, loadData, saveData, today } from "../data.ts";
import { pagesFor, pushPages } from "../ghost.ts";
import { backupData, syncFile } from "../remote.ts";
import { demoUrl } from "../render.ts";
import { readManifest, readOrigin } from "../repo.ts";
import { takeShot } from "../shot.ts";

/** The shot settings of the demo's repo, when run inside it */
function localShotSettings(slug: string, repo: string | null | undefined)
{
    const dir = process.cwd();
    const inRepo = path.basename(dir) === slug || (!!repo && readOrigin(dir) === repo);
    return inRepo ? readManifest(dir).shot ?? {} : {};
}

export async function shot(config: Config, slug: string, pick: boolean)
{
    const data = loadData(config.dataFile);
    const owner = deploymentOwner(data, slug);
    if (!owner)
    {
        throw new Error(`unknown item "${slug}"`);
    }
    if (owner.variant || owner.item.ext)
    {
        throw new Error(`"${slug}" is ${owner.variant ? "a variant" : "a painting or video"} and has no screenshot`);
    }
    const { item } = owner;

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "medium-"));
    try
    {
        const file = path.join(tmp, `${slug}.jpg`);
        await takeShot(demoUrl(config, slug), file, localShotSettings(slug, item.repo), pick);
        await syncFile(config, file, `${config.static.folders.thumbs}/${slug}.jpg`);
    }
    finally
    {
        fs.rmSync(tmp, { recursive: true, force: true });
    }

    // A new updated date also changes the thumbnail URL, so caches pick up the new shot
    item.updated = today();
    saveData(config.dataFile, data);
    await pushPages(config, data, pagesFor(data, [item.category]));
    await backupData(config);
}
