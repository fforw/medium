import GhostAdminAPI from "@tryghost/admin-api";
import type { Config } from "./config.ts";
import { resolvePage, type Data, type Page } from "./data.ts";
import { renderPage } from "./render.ts";

/** One lexical HTML card keeps Ghost from reformatting the markup */
function lexical(html: string): string
{
    return JSON.stringify({
        root: {
            type: "root", version: 1, direction: null, format: "", indent: 0,
            children: [{ type: "html", version: 1, html }],
        },
    });
}

function isNotFound(e: unknown): boolean
{
    return e instanceof Error && (e as Error & { type?: string }).type === "NotFoundError";
}

/** Regenerates the given pages completely. New pages are created as drafts. */
export async function pushPages(config: Config, data: Data, pages: Page[])
{
    const api = new GhostAdminAPI({ url: config.ghost.url, key: config.ghost.adminKey, version: "v5.0" });
    for (const page of pages)
    {
        const fields = { title: page.title, lexical: lexical(renderPage(config, data, page)) };
        let existing;
        try
        {
            existing = await api.pages.read({ slug: page.slug });
        }
        catch (e)
        {
            if (!isNotFound(e))
            {
                throw e;
            }
        }
        if (existing)
        {
            // Ghost rejects edits that don't send back the current updated_at
            await api.pages.edit({ id: existing.id, updated_at: existing.updated_at, ...fields });
            console.log(`pushed /${page.slug}/ (${existing.status})`);
        }
        else
        {
            await api.pages.add({ slug: page.slug, status: "draft", ...fields });
            console.log(`created /${page.slug}/ as a draft; publish it in Ghost when it is ready, later pushes keep its status`);
        }
    }
}

/** The pages that page or category slugs stand for, each once */
export function pagesFor(data: Data, slugs: string[]): Page[]
{
    return [...new Set(slugs.map(s => resolvePage(data, s)))];
}
