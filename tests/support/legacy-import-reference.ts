import { embedUrl } from '../../src/lib/documents';

// Frozen reference: DocumentEditor.tsx's pre-extraction DOMParser pipeline.
// Keep this independent of the new converter; no Git checkout is needed to run it.
export function importLegacyWithDOMParser<Block>(legacyHtml: string, origin: string, parseHtmlFragment: (html: string) => Block[]) {
    const original = new DOMParser().parseFromString(legacyHtml, 'text/html');
    original.querySelectorAll('img').forEach((image) => {
        const source = image.getAttribute('src');
        if (source && !/^https?:\/\//i.test(source)) {
            const url = new URL(source, origin);
            image.setAttribute('src', `${url.pathname}${url.search}`);
        }
    });
    const chunks = original.body.innerHTML.split(/(<iframe\b[^>]*>[\s\S]*?<\/iframe>|<img\b[^>]*>)/gi);
    const blocks: (Block | { type: 'embed'; props: { url: string } } | { type: 'image'; props: { url: string; name: string } } | { type: 'paragraph' })[] = [];
    for (const chunk of chunks) {
        if (/^<iframe\b/i.test(chunk)) {
            const element = new DOMParser().parseFromString(chunk, 'text/html').querySelector('iframe');
            const url = embedUrl(element?.getAttribute('src') ?? '');
            if (url) blocks.push({ type: 'embed', props: { url } });
        } else if (/^<img\b/i.test(chunk)) {
            const image = new DOMParser().parseFromString(chunk, 'text/html').querySelector('img');
            const url = image?.getAttribute('src');
            if (url) blocks.push({ type: 'image', props: { url, name: image?.getAttribute('alt') ?? '' } });
        } else if (chunk.trim()) blocks.push(...parseHtmlFragment(chunk));
    }
    return blocks.length ? blocks : [{ type: 'paragraph' as const }];
}
