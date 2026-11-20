import { parse, parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { embedUrl } from './documents';

type Element = DefaultTreeAdapterMap['element'];
type Node = DefaultTreeAdapterMap['node'];
type ImportedBlock = { type: 'embed'; props: { url: string } } | { type: 'image'; props: { url: string; name: string } } | { type: 'paragraph' };
function elements(node: Node): Element[] {
    return [...('tagName' in node ? [node] : []), ...('childNodes' in node ? node.childNodes.flatMap(elements) : [])];
}
const attribute = (element: Element | undefined, name: string) => element?.attrs.find((item) => item.name === name)?.value;

// HTML import is deliberately lossy. Supported media keep their order, while
// BlockNote owns interpretation of the surrounding HTML fragments.
export function importLegacyDocument<Block>(html: string, origin: string, parseHtmlFragment: (html: string) => Block[]): (Block | ImportedBlock)[] {
    // Match inert DOMParser HTML parsing, including noscript content.
    const original = parse(html, { scriptingEnabled: false });
    const all = elements(original);
    for (const image of all.filter((element) => element.tagName === 'img')) {
        const source = image.attrs.find((item) => item.name === 'src');
        if (source?.value && !/^https?:\/\//i.test(source.value)) {
            const url = new URL(source.value, origin);
            source.value = `${url.pathname}${url.search}`;
        }
    }
    const body = all.find((element) => element.tagName === 'body')!;
    const chunks = serialize(body).split(/(<iframe\b[^>]*>[\s\S]*?<\/iframe>|<img\b[^>]*>)/gi);
    const blocks: (Block | ImportedBlock)[] = [];
    for (const chunk of chunks) {
        if (/^<iframe\b/i.test(chunk)) {
            const element = elements(parseFragment(chunk, { scriptingEnabled: false })).find((element) => element.tagName === 'iframe');
            const url = embedUrl(attribute(element, 'src') ?? '');
            if (url) blocks.push({ type: 'embed', props: { url } });
        } else if (/^<img\b/i.test(chunk)) {
            const image = elements(parseFragment(chunk, { scriptingEnabled: false })).find((element) => element.tagName === 'img');
            const url = attribute(image, 'src');
            if (url) blocks.push({ type: 'image', props: { url, name: attribute(image, 'alt') ?? '' } });
        } else if (chunk.trim()) blocks.push(...parseHtmlFragment(chunk));
    }
    return blocks.length ? blocks : [{ type: 'paragraph' }];
}
