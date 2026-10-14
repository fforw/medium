import { chromium } from "playwright";
import type { Shot } from "./repo.ts";
import { ask, closePrompts } from "./prompt.ts";

export const WIDTH = 1200, HEIGHT = 750;
const DEFAULT_DELAY = 5000;

/**
 * Screenshots a deployed page into a JPEG file. With pick, the browser
 * window is visible and the frame is taken when Enter is pressed.
 */
export async function takeShot(url: string, file: string, shot: Shot, pick: boolean)
{
    const browser = await chromium.launch({
        headless: !pick,
        // WebGL without a GPU, and demos with sound that start on their own
        args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
    });
    try
    {
        const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
        page.on("pageerror", e => console.warn(`warning: page error: ${e.message}`));
        await page.goto(url, { waitUntil: "load", timeout: 30000 });
        if (pick)
        {
            await ask("Press Enter to take the shot");
            closePrompts();
        }
        else
        {
            if (shot.click)
            {
                await page.mouse.click(WIDTH / 2, HEIGHT / 2);
            }
            await page.waitForTimeout(shot.delay ?? DEFAULT_DELAY);
        }
        await page.screenshot({ path: file, type: "jpeg", quality: 82 });
    }
    finally
    {
        await browser.close();
    }
}
