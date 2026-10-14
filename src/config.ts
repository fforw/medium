import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Config
{
    ghost: { url: string, adminKey: string };
    static: { rsync: string, url: string };
    dataFile: string;
    /** The template new demo repos are made from, so leftovers of it can be pointed out */
    starter: { repo?: string, placeholders: string[] };
}

export const CONFIG_FILE = path.join(os.homedir(), ".config", "medium", "config.json");

export function expandHome(p: string): string
{
    return p === "~" || p.startsWith("~/") ? path.join(os.homedir(), p.slice(1)) : p;
}

/** Checks an optional object of the config against the types of its keys */
function optional(config: Record<string, unknown>, key: string, types: Record<string, "string" | "string[]">)
{
    const value = config[key] ?? {};
    if (typeof value !== "object" || Array.isArray(value))
    {
        throw new Error(`${CONFIG_FILE}: "${key}" must be an object`);
    }
    for (const [k, v] of Object.entries(value))
    {
        const type = types[k];
        const ok = type === "string" ? typeof v === "string" && !!v
            : type === "string[]" && Array.isArray(v) && v.every(s => typeof s === "string");
        if (!ok)
        {
            throw new Error(type
                ? `${CONFIG_FILE}: "${key}.${k}" must be ${type === "string" ? "a string" : "an array of strings"}`
                : `${CONFIG_FILE}: unknown key "${key}.${k}"`);
        }
    }
    return value;
}

export function loadConfig(): Config
{
    if (!fs.existsSync(CONFIG_FILE))
    {
        throw new Error(`no config at ${CONFIG_FILE}, see the README`);
    }
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    for (const key of ["ghost.url", "ghost.adminKey", "static.rsync", "static.url", "dataFile"])
    {
        const value = key.split(".").reduce((o, k) => o?.[k], config);
        if (typeof value !== "string" || !value)
        {
            throw new Error(`${CONFIG_FILE}: "${key}" is missing`);
        }
    }
    // The client's own check is unanchored, so a key with extra text around it gets as far as the server
    if (!/^[0-9a-f]{24}:[0-9a-f]{64}$/.test(config.ghost.adminKey))
    {
        throw new Error(`${CONFIG_FILE}: "ghost.adminKey" must be Ghost's Admin API key, <24 hex>:<64 hex>`);
    }
    config.starter = optional(config, "starter", { repo: "string", placeholders: "string[]" });
    config.starter.placeholders ??= [];
    config.ghost.url = config.ghost.url.replace(/\/+$/, "");
    config.static.url = config.static.url.replace(/\/+$/, "");
    config.static.rsync = config.static.rsync.replace(/\/+$/, "");
    config.dataFile = expandHome(config.dataFile);
    return config;
}
