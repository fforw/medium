// Renders a list page from the data file. The result goes into a single
// Ghost HTML card, so the CSS is inline and scoped to .ff-gallery.
// Markup and CSS started out as fforw-recovery's tools/demos/gallery.mjs.

import { marked } from "marked";
import type { Config } from "./config.ts";
import { isVideo, mediaFolder, type Data, type Item, type Page, type Variant } from "./data.ts";

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

// Only on pages with video cards: a play badge, and the viewer
const VIDEO_CSS = `
.ff-gallery .ff-card>a[data-video]{position:relative}
.ff-gallery .ff-card>a[data-video]::after{content:"";position:absolute;left:50%;top:50%;width:6rem;height:6rem;margin:-3rem 0 0 -3rem;border-radius:50%;background:rgba(0,0,0,.55) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M9 6l10 6-10 6z' fill='white'/%3E%3C/svg%3E") center/60% no-repeat;pointer-events:none}
.ff-gallery .ff-viewer{padding:0;border:0;background:#000;max-width:95vw;max-height:95vh;overflow:visible}
.ff-gallery .ff-viewer::backdrop{background:rgba(0,0,0,.85)}
.ff-gallery .ff-viewer video{display:block;max-width:95vw;max-height:95vh}
.ff-gallery .ff-viewer button{position:absolute;right:0;bottom:100%;padding:.2rem .8rem;border:0;background:none;color:#fff;font-size:3rem;line-height:1;cursor:pointer}
`.trim();

// Opens video cards in a <dialog> over the page. The cards stay plain
// links to the files, so without this script the browser plays them.
// The URL hash names the open video, so links to it work and Back closes it.
const VIEWER = `
<dialog class="ff-viewer"><button type="button" aria-label="Close">&times;</button><video controls autoplay loop playsinline></video></dialog>
<script>
(() => {
    const gallery = document.currentScript.parentElement;
    const dialog = gallery.querySelector(".ff-viewer");
    const video = dialog.querySelector("video");
    const videos = new Map([...gallery.querySelectorAll("a[data-video]")].map(a => [a.closest(".ff-card").id, a.href]));
    let pushed = false;

    function sync()
    {
        const src = videos.get(location.hash.slice(1));
        if (src)
        {
            if (video.getAttribute("src") !== src)
            {
                video.src = src;
            }
            if (!dialog.open)
            {
                dialog.showModal();
            }
            video.play().catch(() => {});
        }
        else if (dialog.open)
        {
            dialog.close();
        }
    }

    gallery.addEventListener("click", e => {
        const a = e.target.closest("a[data-video]");
        if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        {
            return;
        }
        e.preventDefault();
        history.pushState(null, "", "#" + a.closest(".ff-card").id);
        pushed = true;
        sync();
    });
    dialog.querySelector("button").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", e => e.target === dialog && dialog.close());
    // Esc, the button, the backdrop and Back all end here
    dialog.addEventListener("close", () => {
        video.pause();
        video.removeAttribute("src");
        video.load();
        if (videos.has(location.hash.slice(1)))
        {
            if (pushed)
            {
                history.back();
            }
            else
            {
                history.replaceState(null, "", location.pathname + location.search);
            }
        }
        pushed = false;
    });
    addEventListener("popstate", sync);
    sync();
})();
</script>`.trim();

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
    return item.ext ? `${config.static.url}/${mediaFolder(item)}/${item.slug}.${item.ext}` : demoUrl(config, item.slug);
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
<a href="${esc(url)}"${isVideo(item) ? " data-video" : ""}><img src="${esc(thumbUrl(config, item))}" alt="${esc(item.title)}" loading="lazy" width="600" height="375"></a>
<h3><a href="${esc(url)}"${isVideo(item) ? " data-video" : ""}>${esc(item.title)}</a><span class="ff-year">${item.created.slice(0, 4)}</span></h3>
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

    const videos = data.items.some(i => isVideo(i) && !i.hidden && categories.some(c => c.slug === i.category));
    return `<div class="ff-gallery kg-width-wide">
<style>${CSS}${videos ? "\n" + VIDEO_CSS : ""}</style>
${intro(page.intro)}${body}${videos ? "\n" + VIEWER : ""}
</div>`;
}
