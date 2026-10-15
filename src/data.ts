import fs from "node:fs";
import type { Config } from "./config.ts";

export interface Page
{
    slug: string;
    title: string;
    intro?: string;
}

export interface Category
{
    slug: string;
    title: string;
    intro?: string;
    page: string;
}

export interface Variant
{
    slug: string;
    title?: string;
    description?: string;
    /** Deployed, but left off its parent's card */
    hidden?: boolean;
}

export interface Item
{
    slug: string;
    category: string;
    topics: string[];
    title: string;
    description: string;
    repo?: string | null;
    variants: Variant[];
    created: string;
    updated: string;
    hidden?: boolean;
    /** Paintings and videos only: the file's extension, without the dot */
    ext?: string;
    /** Paintings and videos only: the thumbnail's crop centre, as fractions of the image size */
    focus?: [number, number];
    /** Videos only: the second the thumbnail is taken from */
    frame?: number;
}

export interface Data
{
    pages: Page[];
    categories: Category[];
    items: Item[];
}

export const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
export const VIDEO_FORMATS = ["mp4", "webm"];

export function isVideo(item: Item): boolean
{
    return !!item.ext && VIDEO_FORMATS.includes(item.ext);
}

/** The static folder a painting or video file lives in */
export function mediaFolder(config: Config, item: Item): string
{
    return isVideo(item) ? config.static.folders.videos : config.static.folders.images;
}

export function loadData(file: string): Data
{
    if (!fs.existsSync(file))
    {
        throw new Error(`no data file at ${file}`);
    }
    // An empty file, as left by touch, is a data file with nothing in it yet
    const text = fs.readFileSync(file, "utf8");
    const data = text.trim() ? JSON.parse(text) : {};
    data.pages ??= [];
    data.categories ??= [];
    data.items ??= [];
    for (const item of data.items)
    {
        item.topics ??= [];
        item.variants ??= [];
    }
    return data;
}

/** Writes to a temporary file first, so a crash never leaves half a data file */
export function saveData(file: string, data: Data)
{
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 4) + "\n");
    fs.renameSync(tmp, file);
}

/** A process that isn't running anymore can't hold a lock */
function isRunning(pid: number): boolean
{
    try
    {
        process.kill(pid, 0);
        return true;
    }
    catch (e)
    {
        // EPERM: running, but as another user
        return (e as NodeJS.ErrnoException).code === "EPERM";
    }
}

/**
 * Moves the lock aside before looking at it again, so a run that broke the same stale lock
 * a moment earlier and took a new one doesn't lose that new one
 */
function breakStaleLock(lock: string, pid: number)
{
    const aside = `${lock}.${process.pid}`;
    try
    {
        fs.renameSync(lock, aside);
    }
    catch
    {
        // someone else got there first
        return;
    }
    const now = Number(fs.readFileSync(aside, "utf8"));
    if (Object.is(now, pid))
    {
        console.warn(`removed the stale lock ${lock}${pid ? ` of process ${pid}` : ""}`);
    }
    else
    {
        // a live lock: put it back, unless yet another run took the lock in between
        try
        {
            fs.linkSync(aside, lock);
        }
        catch
        {
        }
    }
    fs.rmSync(aside, { force: true });
}

/**
 * Runs fn while holding the data file's lock, a file next to it holding the owner's pid.
 * Every medium run that writes the data file, or pushes pages from it, takes turns this way,
 * so one run can't overwrite what another one added in the meantime.
 */
export async function withDataLock<T>(file: string, fn: () => T | Promise<T>): Promise<T>
{
    const lock = file + ".lock";
    let waiting = false;
    for (;;)
    {
        try
        {
            fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
            break;
        }
        catch (e)
        {
            if ((e as NodeJS.ErrnoException).code !== "EEXIST")
            {
                throw e;
            }
        }
        let pid = NaN;
        let age = 0;
        try
        {
            pid = Number(fs.readFileSync(lock, "utf8"));
            age = Date.now() - fs.statSync(lock).mtimeMs;
        }
        catch
        {
            // released in the meantime
            continue;
        }
        // An empty lock is one just created and not written yet, unless it stays empty
        if (pid ? !isRunning(pid) : age > 10_000)
        {
            breakStaleLock(lock, pid);
            continue;
        }
        if (!waiting)
        {
            console.log(`waiting for another medium run${pid ? ` (process ${pid})` : ""} to finish with the data file`);
            waiting = true;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    try
    {
        return await fn();
    }
    finally
    {
        fs.rmSync(lock, { force: true });
    }
}

/**
 * Applies a change to the data file as it is now, not as it was when the run started.
 * fn gets freshly loaded data under the lock and changes it in place; its result is returned.
 */
export function updateData<T>(file: string, fn: (data: Data) => T): Promise<T>
{
    return withDataLock(file, () => {
        const data = loadData(file);
        const result = fn(data);
        saveData(file, data);
        return result;
    });
}

/** The date in local time as YYYY-MM-DD, today by default */
export function today(d = new Date()): string
{
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function findItem(data: Data, slug: string): Item | undefined
{
    return data.items.find(i => i.slug === slug);
}

/** The item a deployment belongs to: either the item itself, or the item it is a variant of */
export function deploymentOwner(data: Data, name: string): { item: Item, variant?: Variant } | undefined
{
    for (const item of data.items)
    {
        if (item.slug === name)
        {
            return { item };
        }
        const variant = item.variants.find(v => v.slug === name);
        if (variant)
        {
            return { item, variant };
        }
    }
    return undefined;
}

export function findCategory(data: Data, slug: string): Category
{
    const category = data.categories.find(c => c.slug === slug);
    if (!category)
    {
        throw new Error(`unknown category "${slug}", known: ${data.categories.map(c => c.slug).join(", ")}`);
    }
    return category;
}

export function findPage(data: Data, slug: string): Page
{
    const page = data.pages.find(p => p.slug === slug);
    if (!page)
    {
        throw new Error(`unknown page "${slug}", known: ${data.pages.map(p => p.slug).join(", ")}`);
    }
    return page;
}

/** The page a page or category slug stands for */
export function resolvePage(data: Data, slug: string): Page
{
    const category = data.categories.find(c => c.slug === slug);
    return findPage(data, category ? category.page : slug);
}
