import fs from "node:fs";
import { spawn } from "node:child_process";

/** Grabs one frame of a video as a PNG, for the thumbnail */
export function grabFrame(video: string, second: number, file: string): Promise<void>
{
    return new Promise((resolve, reject) => {
        // -ss before -i seeks by keyframes first, which is fast on long videos
        const child = spawn("ffmpeg", ["-v", "error", "-y", "-ss", String(second), "-i", video, "-frames:v", "1", file], { stdio: ["ignore", "inherit", "inherit"] });
        child.on("error", e => reject((e as NodeJS.ErrnoException).code === "ENOENT"
            ? new Error("ffmpeg is needed for video thumbnails, e.g. sudo port install ffmpeg")
            : e));
        child.on("close", code => {
            if (code !== 0)
            {
                reject(new Error(`ffmpeg exited with ${code}`));
            }
            // ffmpeg succeeds without output when seeking past the end
            else if (!fs.existsSync(file))
            {
                reject(new Error(`${video} has no frame at ${second}s`));
            }
            else
            {
                resolve();
            }
        });
    });
}
