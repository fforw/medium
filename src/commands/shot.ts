import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Config } from "../config.ts";
import { deploymentOwner, findItem, loadData, today, updateData } from "../data.ts";
import { pagesFor, publish } from "../ghost.ts";
import { syncFile } from "../remote.ts";
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

    // A new updated date also changes the thumbnail URL, so caches pick up the new shot.
    // Set in the data file as it is now, since picking a frame by hand can take a while.
    const category = await updateData(config.dataFile, data => {
        const current = findItem(data, slug);
        if (!current)
        {
            throw new Error(`"${slug}" was removed from the data file meanwhile`);
        }
        current.updated = today();
        return current.category;
    });
    await publish(config, data => pagesFor(data, [category]));
}
