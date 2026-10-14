import type { Config } from "../config.ts";
import { loadData } from "../data.ts";
import { pagesFor, pushPages } from "../ghost.ts";
import { backupData } from "../remote.ts";

export async function push(config: Config, slugs: string[], all: boolean)
{
    const data = loadData(config.dataFile);
    if (!all && !slugs.length)
    {
        throw new Error("name pages or categories to push, or use --all");
    }
    await pushPages(config, data, all ? data.pages : pagesFor(data, slugs));
    await backupData(config);
}
