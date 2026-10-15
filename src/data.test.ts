import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadData, saveData, updateData, type Item } from "./data.ts";

function tempDataFile(): string
{
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "medium-test-"));
    const file = path.join(dir, "data.json");
    fs.writeFileSync(file, "");
    return file;
}

function painting(slug: string): Item
{
    return { slug, category: "paintings", topics: [], title: slug, description: "", variants: [], created: "2026-10-15", updated: "2026-10-15", ext: "png" };
}

/** What medium add did before: load at the start, save the whole file at the end */
test("two interleaved adds both survive", async () => {
    const file = tempDataFile();
    // both runs start, and the user answers their prompts in parallel
    const granny = loadData(file);
    const automato = loadData(file);
    // Automato's run upserts into the file as it is now
    await updateData(file, data => data.items.push(painting("automato")));
    // Granny's run, still holding its old view, finishes last
    await updateData(file, data => data.items.push(painting("granny-chanterelle")));
    assert.deepEqual(loadData(file).items.map(i => i.slug), ["automato", "granny-chanterelle"]);

    // whereas saving the old view, as before, drops Automato
    granny.items.push(painting("granny-chanterelle"));
    automato.items.push(painting("automato"));
    saveData(file, automato);
    saveData(file, granny);
    assert.deepEqual(loadData(file).items.map(i => i.slug), ["granny-chanterelle"]);
});

/** Separate processes, like the Terminal windows of the Finder app */
test("concurrent processes don't lose updates", async () => {
    const file = tempDataFile();
    const data = new URL("./data.ts", import.meta.url).href;
    const script = `
        import { updateData } from ${JSON.stringify(data)};
        const [file, name] = process.argv.slice(1);
        for (let i = 0; i < 20; i++)
        {
            await updateData(file, data => {
                data.items.push({ slug: name + "-" + i, category: "c", topics: [], title: "", description: "", variants: [], created: "", updated: "" });
            });
        }
    `;
    const runs = ["a", "b", "c", "d"].map(name => new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, ["--input-type=module", "-e", script, file, name], { stdio: ["ignore", "ignore", "inherit"] });
        child.on("error", reject);
        child.on("close", code => code === 0 ? resolve() : reject(new Error(`run ${name} exited with ${code}`)));
    }));
    await Promise.all(runs);
    assert.equal(loadData(file).items.length, 80);
    assert.ok(!fs.existsSync(file + ".lock"));
});

test("a lock left by a crashed run is taken over", async () => {
    const file = tempDataFile();
    const dead = spawnSync(process.execPath, ["-e", "console.log(process.pid)"], { encoding: "utf8" });
    fs.writeFileSync(file + ".lock", dead.stdout.trim());
    await updateData(file, data => data.items.push(painting("automato")));
    assert.deepEqual(loadData(file).items.map(i => i.slug), ["automato"]);
    assert.ok(!fs.existsSync(file + ".lock"));
});
