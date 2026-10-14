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

/** Asks until parse accepts the answer; a rejected answer is filled in again to correct */
export async function askUntil<T>(question: string, def: string, parse: (s: string) => T | undefined, hint: string): Promise<T>
{
    for (;;)
    {
        const answer = await ask(question, def);
        const value = parse(answer);
        if (value !== undefined)
        {
            return value;
        }
        console.log(`  ${hint}`);
        def = answer;
    }
}

export function closePrompts()
{
    rl?.close();
    rl = undefined;
}
