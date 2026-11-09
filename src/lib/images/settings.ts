export const imageWidths = [160, 240, 320, 480, 640, 960, 1280, 1920] as const;
export const proseSizes = '(max-width: 660px) calc(63vw - 36px), 556px';
export const gallerySizes = '(max-width: 660px) calc(21vw - 36px), 160px';
export const wordpressHost = 'uwannastealmgswag.art.blog';

// Intrinsic sizes of the exact existing WordPress sources, verified 2026-11-09.
// No request-time dimension probes, storage migration, or arbitrary remote proxy.
export const wordpressImages = new Map<string, { width: number; height: number }>([
    ['2025/05/img_2312.jpg?w=768', 768, 1024],
    ['2025/05/f1f01fc1-f337-4f5e-adb2-27b9feffd73e-1.jpg?w=590', 590, 442],
    ['2025/06/image.jpg?w=261', 261, 393],
    ['2025/05/2df3f1b9-2e49-453c-ae33-61f459d382ee-1.jpg?w=590', 590, 442],
    ['2025/06/77084474462__f2353835-f8b0-47a2-8ca8-719a8ac4fd7f.jpg?w=768', 768, 1024],
    ['2025/05/img_2285-1.png?w=473', 473, 1023],
    ['2025/06/4707726d-c20e-47f3-aa5c-b3d8634cf181-1.jpg?w=576', 576, 1024],
    ['2025/05/img_2230.jpg?w=768', 768, 1024],
    ['2025/06/image-1.jpg', 922, 744], ['2025/06/image-2.jpg', 924, 809],
    ['2025/06/image-3.jpg', 913, 774], ['2025/06/image-4.jpg', 924, 813],
    ['2025/06/image-5.jpg', 924, 621], ['2025/06/img_2307.jpg', 1500, 2000],
    ['2025/06/img_2448-1.png', 924, 2000], ['2025/06/image-6.jpg', 832, 1281],
].map(([path, width, height]) => [`https://${wordpressHost}/wp-content/uploads/${path}`, { width: Number(width), height: Number(height) }] as const));

export function responsiveWidths(width: number) {
    const maximum = Math.min(width, 1920);
    return [...new Set([...imageWidths.filter((value) => value <= maximum), maximum])];
}
