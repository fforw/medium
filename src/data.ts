import fs from "node:fs";

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
    /** Paintings only: the image's file extension, without the dot */
    ext?: string;
    /** Paintings only: the thumbnail's crop centre, as fractions of the image size */
    focus?: [number, number];
}

export interface Data
{
    pages: Page[];
    categories: Category[];
    items: Item[];
}

export const PAINTINGS = "paintings";

export function loadData(file: string): Data
{
    if (!fs.existsSync(file))
    {
        throw new Error(`no data file at ${file}`);
    }
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
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

export function today(): string
{
    const d = new Date();
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
