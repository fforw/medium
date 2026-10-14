// Renders a list page from the data file. The result goes into a single
// Ghost HTML card, so the CSS is inline and scoped to .ff-gallery.
// Markup and CSS started out as fforw-recovery's tools/demos/gallery.mjs.

import { marked } from "marked";
import type { Config } from "./config.ts";
import type { Data, Item, Page, Variant } from "./data.ts";

const CSS = `
.ff-gallery{--gap:1.6rem}
.ff-gallery>.ff-intro{margin:0 0 2rem}
.ff-gallery nav{display:flex;flex-wrap:wrap;gap:.4rem 1.2rem;margin:0 0 2rem;font-size:1.6rem}
.ff-gallery section{margin:0 0 4rem}
.ff-gallery h2{margin:0 0 .4rem}
.ff-gallery section>.ff-intro{margin:0 0 1.6rem;opacity:.75}
.ff-gallery .ff-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--gap)}
.ff-gallery .ff-card{margin:0;display:flex;flex-direction:column;font-size:1.5rem;line-height:1.45}
.ff-gallery .ff-card>a{display:block;aspect-ratio:16/10;overflow:hidden;border-radius:4px;background:#111}
.ff-gallery .ff-card img{width:100%;height:100%;object-fit:cover;display:block;margin:0;transition:transform .3s}
.ff-gallery .ff-card>a:hover img{transform:scale(1.04)}
.ff-gallery .ff-card h3{margin:.8rem 0 .2rem;font-size:1.8rem;line-height:1.3}
.ff-gallery .ff-card h3 a{text-decoration:none;box-shadow:none}
.ff-gallery .ff-year{font-weight:400;opacity:.55;font-size:1.4rem;margin-left:.4rem}
.ff-gallery .ff-card p{margin:0 0 .4rem}
.ff-gallery .ff-meta{font-size:1.35rem;opacity:.8}
.ff-gallery .ff-meta a{word-break:break-word}
`.trim();

function esc(s: string): string
{
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function md(s: string | undefined): string
{
    return s ? (marked.parse(s, { async: false }) as string).trim() : "";
}

export function demoUrl(config: Config, slug: string): string
{
    return `${config.static.url}/demo/${slug}/`;
}

/** Where a card links to: the demo, or the full painting */
function itemUrl(config: Config, item: Item): string
{
    return item.ext ? `${config.static.url}/paintings/${item.slug}.${item.ext}` : demoUrl(config, item.slug);
}

/** The thumbnail URL changes with every update, so caches don't keep the old picture */
function thumbUrl(config: Config, item: Item): string
{
    return `${config.static.url}/thumbs/${item.slug}.jpg?v=${item.updated}`;
}

// "Burning Chrome: Vroom" -> "Vroom" under its head "Burning Chrome 2021"
function variantLabel(variant: Variant, head: Item): string
{
    if (!variant.title)
    {
        return variant.slug;
    }
    const prefix = head.title.replace(/\s+\d{4}$/, "");
    const t = variant.title.startsWith(prefix) ? variant.title.slice(prefix.length).replace(/^[:\s]+/, "") : variant.title;
    return t || variant.slug;
}

function card(config: Config, item: Item): string
{
    const url = itemUrl(config, item);
    const meta = [];
    const variants = item.variants.filter(v => !v.hidden);
    if (variants.length)
    {
        meta.push("Variants: " + variants.map(v =>
            `<a href="${esc(demoUrl(config, v.slug))}"${v.description ? ` title="${esc(v.description)}"` : ""}>${esc(variantLabel(v, item))}</a>`
        ).join(", "));
    }
    if (item.repo)
    {
        meta.push(`<a href="${esc(item.repo)}">Source on GitHub</a>`);
    }
    return `<article class="ff-card" id="item-${esc(item.slug)}">
<a href="${esc(url)}"><img src="${esc(thumbUrl(config, item))}" alt="${esc(item.title)}" loading="lazy" width="600" height="375"></a>
<h3><a href="${esc(url)}">${esc(item.title)}</a><span class="ff-year">${item.created.slice(0, 4)}</span></h3>
${md(item.description)}${meta.length ? `\n<p class="ff-meta">${meta.join(" · ")}</p>` : ""}
</article>`;
}

/** Visible cards of one category, newest first */
function cards(config: Config, data: Data, category: string): string[]
{
    return data.items
        .filter(i => i.category === category && !i.hidden)
        .sort((a, b) => b.created.localeCompare(a.created) || a.title.localeCompare(b.title))
        .map(i => card(config, i));
}

function grid(cards: string[]): string
{
    return `<div class="ff-grid">\n${cards.join("\n")}\n</div>`;
}

function intro(markdown: string | undefined): string
{
    return markdown ? `<div class="ff-intro">${md(markdown)}</div>\n` : "";
}

export function renderPage(config: Config, data: Data, page: Page): string
{
    const categories = data.categories.filter(c => c.page === page.slug);
    let body;
    if (categories.length === 1)
    {
        body = intro(categories[0].intro) + grid(cards(config, data, categories[0].slug));
    }
    else
    {
        const sections = categories
            .map(c => ({ c, cards: cards(config, data, c.slug) }))
            .filter(s => s.cards.length);
        const nav = sections.map(({ c }) => `<a href="#${esc(c.slug)}">${esc(c.title)}</a>`).join("\n");
        body = `<nav>\n${nav}\n</nav>\n` + sections.map(({ c, cards }) => `<section id="${esc(c.slug)}">
<h2>${esc(c.title)}</h2>
${intro(c.intro)}${grid(cards)}
</section>`).join("\n");
    }

    return `<div class="ff-gallery kg-width-wide">
<style>${CSS}</style>
${intro(page.intro)}${body}
</div>`;
}
