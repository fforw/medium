import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface Config
{
    ghost: { url: string, adminKey: string };
    static: { rsync: string, url: string };
    dataFile: string;
}

export const CONFIG_FILE = path.join(os.homedir(), ".config", "medium", "config.json");

export function expandHome(p: string): string
{
    return p === "~" || p.startsWith("~/") ? path.join(os.homedir(), p.slice(1)) : p;
}

export function loadConfig(): Config
{
    if (!fs.existsSync(CONFIG_FILE))
    {
        throw new Error(`no config at ${CONFIG_FILE}, see design.md`);
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
    config.ghost.url = config.ghost.url.replace(/\/+$/, "");
    config.static.url = config.static.url.replace(/\/+$/, "");
    config.static.rsync = config.static.rsync.replace(/\/+$/, "");
    config.dataFile = expandHome(config.dataFile);
    return config;
}
