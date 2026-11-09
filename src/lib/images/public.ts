import { getImage, imageConfig, inferRemoteSize } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { mediaPath } from '../documents';
import { gallerySizes, proseSizes, responsiveWidths, wordpressImages } from './settings';
import { localImages } from './sources';

type Element = DefaultTreeAdapterMap['element'];

export async function responsiveImages(html: string, origin: string): Promise<string> {
    const fragment = parseFragment(html);
    const jobs: Promise<void>[] = [];
    const visit = (node: DefaultTreeAdapterMap['node'], gallery = false) => {
        const inGallery = gallery || ('tagName' in node && node.tagName === 'figure');
        if ('tagName' in node && node.tagName === 'img') jobs.push(optimize(node, inGallery));
        if ('childNodes' in node) node.childNodes.forEach((child) => visit(child, inGallery));
    };
    const optimize = async (image: Element, gallery: boolean) => {
        const src = image.attrs.find((attr) => attr.name === 'src')?.value;
        if (!src) return;
        let local: ImageMetadata | undefined;
        try { local = localImages.get(decodeURIComponent(src.replace(/^\//, ''))); }
        catch { return; }
        const remote = wordpressImages.get(src);
        const uploaded = mediaPath.test(src);
        if (!local && !remote && !uploaded) return; // Includes every original GIF and private signed URL.
        try {
            // Only public feed HTML takes this path. Private preview/editor HTML
            // never enters Astro's optimizer. Same-origin caching is intentional.
            const probe = uploaded ? await inferRemoteSize(new URL(src, origin).href, imageConfig) : undefined;
            if (probe?.format === 'gif') return;
            const width = local?.width ?? remote?.width ?? probe!.width;
            const height = local?.height ?? remote?.height ?? probe!.height;
            const style = image.attrs.find((attr) => attr.name === 'style')?.value ?? '';
            const cap = style.match(/(?:max-width:\s*|width:min\(90%,)(\d+(?:\.\d+)?)px/)?.[1];
            const sizes = gallery ? gallerySizes : cap
                ? `(max-width: 660px) min(${cap}px, calc(63vw - 36px)), min(${cap}px, 556px)` : proseSizes;
            const imageSource = local ?? (uploaded ? new URL(src, origin).href : src);
            const optimized = await getImage({ src: imageSource,
                width, height, widths: responsiveWidths(width), sizes, format: 'webp', quality: 85 });
            const attributes: Record<string, string> = { src: optimized.src, srcset: optimized.srcSet.attribute, sizes,
                width: String(width), height: String(height), loading: 'lazy', decoding: 'async', 'data-original-src': src };
            // Match Astro's own HTML content renderer. Its toolbar recognizes
            // getImage output through this DEV-only marker, not through srcset.
            const originalSource = typeof imageSource === 'string' ? imageSource : imageSource.src;
            if (import.meta.env.DEV && optimized.src !== originalSource) attributes['data-image-component'] = 'true';
            for (const [name, value] of Object.entries(attributes)) {
                const existing = image.attrs.find((attr) => attr.name === name);
                if (existing) existing.value = value;
                else image.attrs.push({ name, value });
            }
        } catch {
            // Optimization is optional: retain the original, still-gated URL if
            // its native metadata probe fails (e.g. protected preview hosting).
        }
    };
    visit(fragment);
    await Promise.all(jobs);
    return serialize(fragment);
}

export async function artworkBackground(src: ImageMetadata, presets: Record<'small' | 'medium' | 'large', [number, number]>) {
    return (await Promise.all(Object.entries(presets).map(async ([name, widths]) => {
        const images = await Promise.all(widths.map((width) => getImage({ src, width: Math.min(width, src.width), format: 'webp', quality: 85 })));
        return `--artwork-${name}:image-set(url(${JSON.stringify(images[0].src)}) 1x,url(${JSON.stringify(images[1].src)}) 2x)`;
    }))).join(';');
}
