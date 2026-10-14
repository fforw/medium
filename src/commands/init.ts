import fs from "node:fs";
import path from "node:path";
import GhostAdminAPI from "@tryghost/admin-api";
import { CONFIG_FILE, expandHome, isAdminKey, parseConfig } from "../config.ts";
import { ask, askUntil, closePrompts } from "../prompt.ts";
import { run } from "../remote.ts";

const KEY_HINT = "the Admin API key of a custom integration (Ghost Admin, Settings, Integrations), <24 hex>:<64 hex>";

function parseUrl(s: string): string | undefined
{
    return /^https?:\/\/[^/\s]+/.test(s) ? s.replace(/\/+$/, "") : undefined;
}

/** The existing config file as plain JSON, to fill in the prompts */
function readExisting(): Record<string, any>
{
    if (!fs.existsSync(CONFIG_FILE))
    {
        return {};
    }
    try
    {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
    catch (e)
    {
        console.warn(`warning: ${CONFIG_FILE} is no valid JSON (${(e as Error).message}), starting over`);
        return {};
    }
}

/** Asks for list entries one by one, until an empty answer */
async function askList(question: string, existing: string[]): Promise<string[]>
{
    const list = [];
    for (let i = 0; ; i++)
    {
        const answer = await ask(`${question} ${i + 1} (empty to finish)`, existing[i] ?? "");
        if (!answer)
        {
            return list;
        }
        list.push(answer);
    }
}

/** Fills or creates the data file, so the first push has something to read */
function ensureDataFile(file: string)
{
    const full = expandHome(file);
    if (fs.existsSync(full))
    {
        return;
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify({ pages: [], categories: [], items: [] }, null, 4) + "\n");
    console.log(`created the data file ${full}`);
}

/** Tries the Ghost key and the ssh host, warning instead of failing, so a config can be written offline */
async function check(config: ReturnType<typeof parseConfig>)
{
    try
    {
        const api = new GhostAdminAPI({ url: config.ghost.url, key: config.ghost.adminKey, version: "v5.0" });
        const site = await api.site.read();
        console.log(`ok: Ghost answers as "${site.title}"`);
    }
    catch (e)
    {
        console.warn(`warning: Ghost check failed: ${(e as Error).message}`);
    }
    const host = config.static.rsync.slice(0, config.static.rsync.indexOf(":"));
    try
    {
        // BatchMode fails instead of asking for a password, which rsync can't answer later either
        await run("ssh", ["-o", "BatchMode=yes", host, "true"]);
        console.log(`ok: ssh to ${host} works`);
    }
    catch
    {
        console.warn(`warning: "ssh ${host}" failed; medium needs it to work without a password prompt`);
    }
}

export async function init()
{
    const ex = readExisting();
    console.log(`Writing ${CONFIG_FILE}.`);
    console.log("Each answer is filled in with the current or suggested value; edit it or press Enter.\n");
    try
    {
        console.log("The Ghost blog the list pages go to:");
        const url = await askUntil("Blog URL", ex.ghost?.url ?? "https://", parseUrl, "a URL like https://blog.example.com");
        const oldKey: string | undefined = isAdminKey(ex.ghost?.adminKey ?? "") ? ex.ghost.adminKey : undefined;
        // The key isn't filled in, so it doesn't end up on the screen
        const adminKey = await askUntil(
            oldKey ? "Admin API key (empty keeps the current one)" : "Admin API key",
            "",
            s => !s && oldKey ? oldKey : isAdminKey(s) ? s : undefined,
            KEY_HINT
        );

        console.log("\nWhere the files go, by rsync over ssh:");
        const rsync = await askUntil("Target, as ssh host:path (path relative to your home there)", ex.static?.rsync ?? "",
            s => /^[^:/\s]+:\S*$/.test(s) ? s : undefined, "an ssh host and a path, like myhost:static");
        const staticUrl = await askUntil("Public URL of that directory", ex.static?.url ?? `${url}/static`, parseUrl, "a URL like https://blog.example.com/static");

        console.log("\nThe data file, the source of truth for what is published:");
        const dataFile = await askUntil("Data file", ex.dataFile ?? "~/Documents/medium-data.json", s => s || undefined, "a file path; ~ is allowed");

        console.log("\nOptional: the template new demo repos are made from, to warn about its leftovers.");
        const repo = await ask("Template repo URL (empty for none)", ex.starter?.repo ?? "");
        const placeholders = repo ? await askList("Template text a demo README should replace", ex.starter?.placeholders ?? []) : [];

        console.log("\nOptional: the categories \"medium add\" files new images and videos under.");
        const images = await ask("Category for images (empty for none)", ex.categories?.images ?? "");
        const videos = await ask("Category for videos (empty for none)", ex.categories?.videos ?? "");

        // Keys this version doesn't know are kept as they are
        const raw: Record<string, unknown> = {
            ...ex,
            ghost: { ...ex.ghost, url, adminKey },
            static: { ...ex.static, rsync, url: staticUrl },
            dataFile,
        };
        delete raw.starter;
        delete raw.categories;
        if (repo)
        {
            raw.starter = { repo, placeholders };
        }
        if (images || videos)
        {
            raw.categories = { ...(images ? { images } : {}), ...(videos ? { videos } : {}) };
        }
        const config = parseConfig(raw);

        fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(raw, null, 4) + "\n", { mode: 0o600 });
        // mode only applies to a new file
        fs.chmodSync(CONFIG_FILE, 0o600);
        console.log(`\nwrote ${CONFIG_FILE}`);
        ensureDataFile(dataFile);

        await check(config);
        console.log("\nNext, add your pages and categories to the data file (see the README), then \"medium push --all\".");
    }
    finally
    {
        closePrompts();
    }
}
