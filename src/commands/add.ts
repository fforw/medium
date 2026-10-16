import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Config } from "../config.ts";
import { deploymentOwner, findCategory, IMAGE_FORMATS, isVideo, loadData, today, updateData, VIDEO_FORMATS, type Data, type Item } from "../data.ts";
import { grabFrame } from "../frame.ts";
import { pagesFor, publish } from "../ghost.ts";
import { ask, askUntil, closePrompts } from "../prompt.ts";
import { ensureDirs, syncFile } from "../remote.ts";
import { makeThumb } from "../thumb.ts";

const FORMATS = [...IMAGE_FORMATS, ...VIDEO_FORMATS];

/** some-painting -> Some Painting, toilet-vespa.3 -> Toilet Vespa 3 */
export function titleCase(slug: string): string
{
    return slug.split(/[-_.\s]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
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

function parseFrame(s: string): number | undefined
{
    const n = Number(s);
    return s && n >= 0 ? n : undefined;
}

/** Asks for the painting's or video's details, defaulting to the stored ones */
async function askDetails(image: string, slug: string, existing: Item | undefined, video: boolean)
{
    console.log(`\n${slug}${existing ? " (already published, the stored values are filled in)" : ""}`);
    const title = await ask("Title", existing?.title ?? titleCase(slug));
    // a painting defaults to its file's mtime, which, unlike the creation time, can be corrected with touch
    const fallback = video ? today() : today(fs.statSync(image).mtime);
    const created = await askUntil("Date", existing?.created ?? fallback, parseDate, "as YYYY-MM-DD");
    const description = await ask("Description (one line of Markdown)", existing?.description);
    const topics = await ask("Topics, comma-separated", existing?.topics.join(", "));
    const frame = video ? await askUntil("Frame (second of the video for the thumbnail)", String(existing?.frame ?? 1), parseFrame, "a number of seconds, like 1 or 2.5") : undefined;
    const focus = await askUntil("Focus x, y (0..1, empty for automatic)", existing?.focus?.join(", ") ?? "", parseFocus, "two numbers between 0 and 1, like 0.3, 0.6");
    return {
        title,
        created,
        topics: topics.split(",").map(t => t.trim()).filter(Boolean),
        description,
        frame,
        focus,
    };
}

/** The item a painting or video replaces, if any */
function checkOwner(data: Data, slug: string, video: boolean): Item | undefined
{
    const owner = deploymentOwner(data, slug);
    if (owner && (owner.variant || !owner.item.ext))
    {
        throw new Error(`"${slug}" is already a demo or variant`);
    }
    if (owner && isVideo(owner.item) !== video)
    {
        throw new Error(`"${slug}" is already a ${video ? "painting" : "video"}`);
    }
    return owner?.item;
}

/** With a category, every file goes into it, also one already published; otherwise new files go into the config's categories */
export async function add(config: Config, images: string[], category?: string)
{
    if (!images.length)
    {
        throw new Error("name the images or videos to add");
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
    if (category)
    {
        findCategory(data, category);
    }
    else
    {
        const kinds = new Set(images.map(f => VIDEO_FORMATS.includes(path.extname(f).slice(1).toLowerCase()) ? "videos" : "images"));
        for (const kind of kinds)
        {
            const name = config.categories[kind];
            if (!name)
            {
                throw new Error(`set "categories.${kind}" in the config to the category new ${kind} go into, or use --category`);
            }
            findCategory(data, name);
        }
    }
    await ensureDirs(config);

    const categories = new Set<string>();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "medium-"));
    try
    {
        for (const image of images)
        {
            const ext = path.extname(image).slice(1).toLowerCase();
            const slug = path.basename(image, path.extname(image));
            const video = VIDEO_FORMATS.includes(ext);
            // Read again for each file, so the defaults include what other runs saved meanwhile
            const existing = checkOwner(loadData(config.dataFile), slug, video);
            const details = await askDetails(image, slug, existing, video);

            let source = image;
            if (video)
            {
                source = path.join(tmp, `${slug}.png`);
                await grabFrame(image, details.frame!, source);
            }
            const thumb = path.join(tmp, `${slug}.jpg`);
            await makeThumb(source, thumb, details.focus ?? undefined);

            const folder = video ? config.static.folders.videos : config.static.folders.images;
            await syncFile(config, image, `${folder}/${slug}.${ext}`);
            await syncFile(config, thumb, `${config.static.folders.thumbs}/${slug}.jpg`);

            // Upserts into the data file as it is now, since the answers can take minutes, during
            // which another medium run may have saved. Saved after each file, so an error later
            // doesn't lose the answers.
            const item = await updateData(config.dataFile, data => {
                const current = checkOwner(data, slug, video);
                // Fields edited by hand, like hidden or a moved category, are kept
                const item: Item = {
                    variants: [],
                    ...current,
                    slug,
                    category: category ?? current?.category ?? config.categories[video ? "videos" : "images"]!,
                    topics: details.topics,
                    title: details.title,
                    description: details.description,
                    created: details.created,
                    updated: today(),
                    ext,
                };
                if (video)
                {
                    item.frame = details.frame;
                }
                if (details.focus)
                {
                    item.focus = details.focus;
                }
                else
                {
                    delete item.focus;
                }
                if (current)
                {
                    data.items[data.items.indexOf(current)] = item;
                }
                else
                {
                    data.items.push(item);
                }
                return item;
            });
            categories.add(item.category);
        }
    }
    finally
    {
        closePrompts();
        fs.rmSync(tmp, { recursive: true, force: true });
    }

    await publish(config, data => pagesFor(data, [...categories]));
}
