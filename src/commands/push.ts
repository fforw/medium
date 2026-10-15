import type { Config } from "../config.ts";
import { pagesFor, publish } from "../ghost.ts";

export async function push(config: Config, slugs: string[], all: boolean)
{
    if (!all && !slugs.length)
    {
        throw new Error("name pages or categories to push, or use --all");
    }
    await publish(config, data => all ? data.pages : pagesFor(data, slugs));
}
