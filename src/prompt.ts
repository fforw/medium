import readline from "node:readline/promises";

let rl: readline.Interface | undefined;

function iface(): readline.Interface
{
    return rl ??= readline.createInterface({ input: process.stdin, output: process.stdout });
}

/** Asks one question; an empty answer takes the default, shown in brackets */
export async function ask(question: string, def = ""): Promise<string>
{
    const answer = (await iface().question(def ? `${question} [${def}]: ` : `${question}: `)).trim();
    return answer || def;
}

export function closePrompts()
{
    rl?.close();
    rl = undefined;
}
