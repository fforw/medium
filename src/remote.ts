import { spawn } from "node:child_process";
import type { Config } from "./config.ts";

export function run(cmd: string, args: string[]): Promise<void>
{
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: "inherit" });
        child.on("error", reject);
        child.on("close", code => code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)));
    });
}

/** Splits "host:path" into its parts */
function target(config: Config): { host: string, root: string }
{
    const m = /^([^:/]+):(.*)$/.exec(config.static.rsync);
    if (!m)
    {
        throw new Error(`static.rsync must be "host:path", not "${config.static.rsync}"`);
    }
    return { host: m[1], root: m[2] || "." };
}

/**
 * Creates the folders under the static root that medium writes into. rsync
 * only creates the last component of a target path, and the macOS
 * openrsync has no --mkpath.
 */
export async function ensureDirs(config: Config)
{
    const { host, root } = target(config);
    await run("ssh", [host, "mkdir", "-p", ...Object.values(config.static.folders).map(d => `${root}/${d}`), "medium"]);
}

/** Syncs a local folder to a folder under the static root, removing what is gone locally */
export async function syncDir(config: Config, local: string, remote: string)
{
    await run("rsync", [
        "-rlptz", "--delete", "--exclude=.git", "--exclude=*.blend",
        local.replace(/\/*$/, "/"),
        `${config.static.rsync}/${remote}/`,
    ]);
}

/** Copies one file to a path under the static root */
export async function syncFile(config: Config, local: string, remote: string)
{
    await run("rsync", ["-tz", local, `${config.static.rsync}/${remote}`]);
}

/** Keeps the offsite copy of the data file in ~/medium/ on the server */
export async function backupData(config: Config)
{
    const { host } = target(config);
    await run("rsync", ["-tz", config.dataFile, `${host}:medium/data.json`]);
}
