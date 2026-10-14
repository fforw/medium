import sharp from "sharp";
import { WIDTH, HEIGHT } from "./shot.ts";

/**
 * Crops a painting to fill the card frame. Without a focus point, sharp
 * picks the region; with one, the crop is centred on it as far as the
 * image edges allow.
 */
export async function makeThumb(image: string, file: string, focus?: [number, number])
{
    let img = sharp(image).autoOrient();
    if (focus)
    {
        // The size after applying the EXIF orientation, which the crop works on
        const { width, height } = (await img.metadata()).autoOrient;
        const w = Math.min(width, Math.round(height * WIDTH / HEIGHT));
        const h = Math.min(height, Math.round(width * HEIGHT / WIDTH));
        const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));
        img = img.extract({
            left: clamp(focus[0] * width - w / 2, width - w),
            top: clamp(focus[1] * height - h / 2, height - h),
            width: w,
            height: h,
        });
    }
    await img
        .resize(WIDTH, HEIGHT, { fit: "cover", position: sharp.strategy.attention })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(file);
}
