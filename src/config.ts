import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Config
{
    ghost: { url: string, adminKey: string };
    static: { rsync: string, url: string, folders: Folders };
    dataFile: string;
    /** The template new demo repos are made from, so leftovers of it can be pointed out */
    starter: { repo?: string, placeholders: string[] };
    /** The categories medium add files new images and videos under */
    categories: { images?: string, videos?: string };
}

/** The folders below the static directory that medium writes to */
export interface Folders
{
    /** Demo deployments, one folder each */
    demos: string;
    /** Card thumbnails of every kind of item */
    thumbs: string;
    images: string;
    videos: string;
}

export const DEFAULT_FOLDERS: Folders = { demos: "demo", thumbs: "thumbs", images: "images", videos: "videos" };

export const CONFIG_FILE = path.join(os.homedir(), ".config", "medium", "config.json");

export function expandHome(p: string): string
{
    return p === "~" || p.startsWith("~/") ? path.join(os.homedir(), p.slice(1)) : p;
}

/** Checks an optional object of the config against the types of its keys; name is its path for messages */
function optional(parent: Record<string, unknown>, key: string, types: Record<string, "string" | "string[]">, name = key)
{
    const value = parent[key] ?? {};
    if (typeof value !== "object" || value === null || Array.isArray(value))
    {
        throw new Error(`${CONFIG_FILE}: "${name}" must be an object`);
    }
    for (const [k, v] of Object.entries(value))
    {
        const type = types[k];
        const ok = type === "string" ? typeof v === "string" && !!v
            : type === "string[]" && Array.isArray(v) && v.every(s => typeof s === "string");
        if (!ok)
        {
            throw new Error(type
                ? `${CONFIG_FILE}: "${name}.${k}" must be ${type === "string" ? "a string" : "an array of strings"}`
                : `${CONFIG_FILE}: unknown key "${name}.${k}"`);
        }
    }
    return value;
}

export function loadConfig(): Config
{
    if (!fs.existsSync(CONFIG_FILE))
    {
        throw new Error(`no config at ${CONFIG_FILE}, run "medium init"`);
    }
    return parseConfig(JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")));
}

/** Checks a config as read from the file, and normalizes it for use */
export function parseConfig(raw: unknown): Config
{
    const config = structuredClone(raw) as Record<string, any>;
    if (typeof config !== "object" || config === null)
    {
        throw new Error(`${CONFIG_FILE}: must be a JSON object`);
    }
    for (const key of ["ghost.url", "ghost.adminKey", "static.rsync", "static.url", "dataFile"])
    {
        const value = key.split(".").reduce((o, k) => o?.[k], config);
        if (typeof value !== "string" || !value)
        {
            throw new Error(`${CONFIG_FILE}: "${key}" is missing`);
        }
    }
    if (!isAdminKey(config.ghost.adminKey))
    {
        throw new Error(`${CONFIG_FILE}: "ghost.adminKey" must be Ghost's Admin API key, <24 hex>:<64 hex>`);
    }
    config.starter = optional(config, "starter", { repo: "string", placeholders: "string[]" });
    config.starter.placeholders ??= [];
    config.categories = optional(config, "categories", { images: "string", videos: "string" });
    config.ghost.url = config.ghost.url.replace(/\/+$/, "");
    config.static.url = config.static.url.replace(/\/+$/, "");
    config.static.rsync = config.static.rsync.replace(/\/+$/, "");
    const folders = optional(config.static, "folders", { demos: "string", thumbs: "string", images: "string", videos: "string" }, "static.folders") as Partial<Folders>;
    config.static.folders = Object.fromEntries(Object.entries(DEFAULT_FOLDERS).map(([k, def]) =>
        [k, (folders[k as keyof Folders] ?? def).replace(/^\/+|\/+$/g, "")]));
    config.dataFile = expandHome(config.dataFile);
    return config as Config;
}

/** The admin-api client's own check is unanchored, so a key with extra text around it gets as far as the server */
export function isAdminKey(key: string): boolean
{
    return /^[0-9a-f]{24}:[0-9a-f]{64}$/.test(key);
}
