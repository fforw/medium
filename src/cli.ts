#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadConfig } from "./config.ts";
import { add } from "./commands/add.ts";
import { deploy } from "./commands/deploy.ts";
import { init } from "./commands/init.ts";
import { list } from "./commands/list.ts";
import { push } from "./commands/push.ts";
import { shot } from "./commands/shot.ts";

const USAGE = `usage:
  medium init                                        create or change the config
  medium deploy [variant] [--slug <slug>] [--pick]   deploy the demo in this repo
  medium add <image>...                              publish paintings
  medium shot <slug> [--pick]                        retake a demo's screenshot
  medium push <page-or-category>... | --all          regenerate list pages
  medium list [category]                             show items and their state`;

async function main()
{
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            slug: { type: "string" },
            pick: { type: "boolean", default: false },
            all: { type: "boolean", default: false },
            help: { type: "boolean", short: "h", default: false },
        },
    });
    const [command, ...args] = positionals;
    if (values.help || !command)
    {
        console.log(USAGE);
        return;
    }

    // init writes the config, so it can't need one
    if (command === "init")
    {
        return init();
    }
    const config = loadConfig();
    switch (command)
    {
        case "deploy":
            if (args.length > 1)
            {
                throw new Error("deploy takes at most one variant name");
            }
            return deploy(config, { variant: args[0], slug: values.slug, pick: values.pick });
        case "add":
            return add(config, args);
        case "shot":
            if (args.length !== 1)
            {
                throw new Error("shot takes one slug");
            }
            return shot(config, args[0], values.pick);
        case "push":
            return push(config, args, values.all);
        case "list":
            return list(config, args[0]);
        default:
            throw new Error(`unknown command "${command}"\n${USAGE}`);
    }
}

main().catch(e => {
    console.error(`medium: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
});
