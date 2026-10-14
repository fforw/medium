import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/** Text from simple-starter's READMEs, old and new, that a demo should have replaced */
const PLACEHOLDERS = [
    "Simple Starter",
    "Simple TypeScript build starter for simple, client-only demos",
    "Simple JS build starter for simple, client-only demos",
];

const STARTER_REPO = /github\.com[:/]fforw\/simple-starter(\.git)?$/;

export interface Shot
{
    delay?: number;
    click?: boolean;
}

export interface Manifest
{
    category?: string;
    topics?: string[];
    shot?: Shot;
}

/** What a deploy reads from the demo repo */
export interface RepoInfo
{
    title?: string;
    description: string;
    repo: string | null;
    manifest: Manifest;
    warnings: string[];
}

function fail(msg: string): never
{
    throw new Error(`package.json: ${msg}`);
}

/** Reads the "ff-medium" field, rejecting unknown keys so typos don't go unnoticed */
export function readManifest(dir: string): Manifest
{
    const file = path.join(dir, "package.json");
    if (!fs.existsSync(file))
    {
        return {};
    }
    const raw = JSON.parse(fs.readFileSync(file, "utf8"))["ff-medium"];
    if (raw === undefined)
    {
        return {};
    }
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    {
        fail(`"ff-medium" must be an object`);
    }
    const manifest: Manifest = {};
    for (const [key, value] of Object.entries(raw))
    {
        switch (key)
        {
            case "category":
                if (typeof value !== "string")
                {
                    fail(`"ff-medium.category" must be a string`);
                }
                // An empty string is simple-starter's way of saying "fill me in"
                if (value)
                {
                    manifest.category = value;
                }
                break;
            case "topics":
                if (!Array.isArray(value) || !value.every(t => typeof t === "string"))
                {
                    fail(`"ff-medium.topics" must be an array of strings`);
                }
                manifest.topics = value;
                break;
            case "shot":
                manifest.shot = readShot(value);
                break;
            default:
                fail(`unknown key "ff-medium.${key}"`);
        }
    }
    return manifest;
}

function readShot(value: unknown): Shot
{
    if (typeof value !== "object" || value === null || Array.isArray(value))
    {
        fail(`"ff-medium.shot" must be an object`);
    }
    const shot: Shot = {};
    for (const [key, v] of Object.entries(value))
    {
        if (key === "delay" && typeof v === "number" && v >= 0)
        {
            shot.delay = v;
        }
        else if (key === "click" && typeof v === "boolean")
        {
            shot.click = v;
        }
        else if (key === "delay" || key === "click")
        {
            fail(`"ff-medium.shot.${key}" must be ${key === "delay" ? "a number of milliseconds" : "true or false"}`);
        }
        else
        {
            fail(`unknown key "ff-medium.shot.${key}"`);
        }
    }
    return shot;
}

/** Splits the README into its first "# heading" and the rest */
export function readReadme(dir: string): { title?: string, description: string }
{
    const file = ["README.md", "readme.md", "Readme.md"].map(f => path.join(dir, f)).find(f => fs.existsSync(f));
    if (!file)
    {
        return { description: "" };
    }
    const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const m = /^#[ \t]+(.+?)[ \t#]*$/m.exec(text);
    if (!m)
    {
        return { description: text.trim() };
    }
    return {
        title: m[1].trim(),
        description: (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim(),
    };
}

/** The web URL of the repo's origin remote, if there is one */
export function readOrigin(dir: string): string | null
{
    try
    {
        const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
        return toWebUrl(url);
    }
    catch
    {
        return null;
    }
}

/** git@github.com:fforw/x.git -> https://github.com/fforw/x */
export function toWebUrl(url: string): string
{
    return url
        .replace(/^git@([^:]+):/, "https://$1/")
        .replace(/^ssh:\/\/git@([^/]+)\//, "https://$1/")
        .replace(/\.git$/, "");
}

export function readRepo(dir: string): RepoInfo
{
    const { title, description } = readReadme(dir);
    const repo = readOrigin(dir);
    const warnings: string[] = [];

    for (const p of PLACEHOLDERS)
    {
        if (title?.includes(p) || description.includes(p))
        {
            warnings.push(`README still contains simple-starter's "${p}"`);
        }
    }
    if (repo && STARTER_REPO.test(repo))
    {
        warnings.push("origin still points to fforw/simple-starter");
    }
    return { title, description, repo, manifest: readManifest(dir), warnings };
}
