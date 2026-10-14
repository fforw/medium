import type { Config } from "../config.ts";
import { findCategory, loadData } from "../data.ts";

export function list(config: Config, only?: string)
{
    const data = loadData(config.dataFile);
    const categories = only ? [findCategory(data, only)] : data.categories;
    for (const c of categories)
    {
        const items = data.items
            .filter(i => i.category === c.slug)
            .sort((a, b) => b.created.localeCompare(a.created) || a.title.localeCompare(b.title));
        console.log(`\n${c.title} (${c.slug}, on /${c.page}/): ${items.length}`);
        const width = Math.max(0, ...items.map(i => i.slug.length));
        for (const i of items)
        {
            const flags = [
                i.hidden ? "hidden" : "",
                i.variants.length ? `${i.variants.length} variant${i.variants.length > 1 ? "s" : ""}` : "",
            ].filter(Boolean).join(", ");
            console.log(`  ${i.slug.padEnd(width)}  ${i.created}  ${i.updated}  ${i.title}${flags ? `  (${flags})` : ""}`);
        }
    }
    const orphans = data.items.filter(i => !data.categories.some(c => c.slug === i.category));
    if (!only && orphans.length)
    {
        console.log(`\nIn unknown categories: ${orphans.map(i => `${i.slug} (${i.category})`).join(", ")}`);
    }
}
