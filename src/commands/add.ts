import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Config } from "../config.ts";
import { deploymentOwner, findCategory, loadData, PAINTINGS, saveData, today, type Item } from "../data.ts";
import { pagesFor, pushPages } from "../ghost.ts";
import { closePrompts, ask } from "../prompt.ts";
import { backupData, ensureDirs, syncFile } from "../remote.ts";
import { makeThumb } from "../thumb.ts";

const FORMATS = ["jpg", "jpeg", "png", "webp", "gif", "avif"];

/** some-painting -> Some Painting, toilet-vespa.3 -> Toilet Vespa 3 */
export function titleCase(slug: string): string
{
    return slug.split(/[-_.\s]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}

async function askUntil<T>(question: string, def: string, parse: (s: string) => T | undefined, hint: string): Promise<T>
{
    for (;;)
    {
        const value = parse(await ask(question, def));
        if (value !== undefined)
        {
            return value;
        }
        console.log(`  ${hint}`);
    }
}

function parseDate(s: string): string | undefined
{
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) ? s : undefined;
}

/** "x, y" as fractions of the image size; empty means no focus */
function parseFocus(s: string): [number, number] | null | undefined
{
    if (!s)
    {
        return null;
    }
    const parts = s.split(/[\s,]+/).map(Number);
    return parts.length === 2 && parts.every(n => n >= 0 && n <= 1) ? [parts[0], parts[1]] : undefined;
}

/** Asks for the painting's details, defaulting to the stored ones */
async function askDetails(slug: string, existing: Item | undefined)
{
    console.log(`\n${slug}${existing ? " (already published, the stored values are filled in)" : ""}`);
    const title = await ask("Title", existing?.title ?? titleCase(slug));
    const created = await askUntil("Date", existing?.created ?? today(), parseDate, "as YYYY-MM-DD");
    const topics = await ask("Topics, comma-separated", existing?.topics.join(", "));
    const description = await ask("Description (one line of Markdown)", existing?.description);
    const focus = await askUntil("Focus x, y (0..1, empty for automatic)", existing?.focus?.join(", ") ?? "", parseFocus, "two numbers between 0 and 1, like 0.3, 0.6");
    return {
        title,
        created,
        topics: topics.split(",").map(t => t.trim()).filter(Boolean),
        description,
        focus,
    };
}

export async function add(config: Config, images: string[])
{
    if (!images.length)
    {
        throw new Error("name the images to add");
    }
    for (const image of images)
    {
        const ext = path.extname(image).slice(1).toLowerCase();
        if (!fs.existsSync(image))
        {
            throw new Error(`no such file: ${image}`);
        }
        if (!FORMATS.includes(ext))
        {
            throw new Error(`${image}: not one of ${FORMATS.join(", ")}`);
        }
    }

    const data = loadData(config.dataFile);
    findCategory(data, PAINTINGS);
    await ensureDirs(config);

    const categories = new Set<string>();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "medium-"));
    try
    {
        for (const image of images)
        {
            const ext = path.extname(image).slice(1).toLowerCase();
            const slug = path.basename(image, path.extname(image));
            const owner = deploymentOwner(data, slug);
            if (owner && (owner.variant || !owner.item.ext))
            {
                throw new Error(`"${slug}" is already a demo or variant`);
            }
            const existing = owner?.item;
            const details = await askDetails(slug, existing);

            const thumb = path.join(tmp, `${slug}.jpg`);
            await makeThumb(image, thumb, details.focus ?? undefined);
            await syncFile(config, image, `paintings/${slug}.${ext}`);
            await syncFile(config, thumb, `thumbs/${slug}.jpg`);

            // Fields edited by hand, like hidden or a moved category, are kept
            const item: Item = {
                variants: [],
                ...existing,
                slug,
                category: existing?.category ?? PAINTINGS,
                topics: details.topics,
                title: details.title,
                description: details.description,
                created: details.created,
                updated: today(),
                ext,
            };
            if (details.focus)
            {
                item.focus = details.focus;
            }
            else
            {
                delete item.focus;
            }
            if (existing)
            {
                data.items[data.items.indexOf(existing)] = item;
            }
            else
            {
                data.items.push(item);
            }
            categories.add(item.category);
            // Saved after each painting, so an error later doesn't lose the answers
            saveData(config.dataFile, data);
        }
    }
    finally
    {
        closePrompts();
        fs.rmSync(tmp, { recursive: true, force: true });
    }

    await pushPages(config, data, pagesFor(data, [...categories]));
    await backupData(config);
}
