import readline from "node:readline/promises";

let rl: readline.Interface | undefined;

function iface(): readline.Interface
{
    return rl ??= readline.createInterface({ input: process.stdin, output: process.stdout });
}

/** Asks one question, with the default already typed in to accept or edit */
export async function ask(question: string, def = ""): Promise<string>
{
    const answer = iface().question(`${question}: `);
    iface().write(def);
    return (await answer).trim();
}

export function closePrompts()
{
    rl?.close();
    rl = undefined;
}
