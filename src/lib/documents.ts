import { z } from 'zod';
import { imageAlternative } from './content-accessibility';

export const MAX_DOCUMENT_BYTES = 1_048_576;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
export const mediaPath = /^\/media\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/;
export class DocumentValidationError extends Error {}

export function safeUrl(value: string, image = false): string | null {
    if (!value || value !== value.trim()) return null;
    if (image && /^[\w .-]+\.(png|jpe?g|gif|webp)$/i.test(value)) return `/${encodeURIComponent(value)}`;
    if (/[\x00-\x20\\]/.test(value)) return null;
    if (value.startsWith('/') && !value.startsWith('//')) return value;
    // Original local filenames remain usable when importing the old HTML.
    try {
        const url = new URL(value);
        if (url.username || url.password) return null;
        return url.protocol === 'https:' || (!image && url.protocol === 'mailto:') ? value : null;
    } catch { return null; }
}

export function embedUrl(value: string): string | null {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
        if (url.hostname === 'open.spotify.com' && /^\/(embed\/)?(track|album|playlist|episode)\/[A-Za-z0-9]+$/.test(url.pathname)) {
            return `https://open.spotify.com/embed/${url.pathname.replace(/^\/(embed\/)?/, '')}`;
        }
        if (url.hostname === 'videopress.com' && /^\/embed\/[A-Za-z0-9]+$/.test(url.pathname)) return `${url.origin}${url.pathname}`;
    } catch { /* Unsupported input is never rendered as an iframe. */ }
    return null;
}

const styles = z.object({
    bold: z.boolean().optional(), italic: z.boolean().optional(), underline: z.boolean().optional(),
    strike: z.boolean().optional(), code: z.boolean().optional(),
    textColor: z.string().max(32).optional(), backgroundColor: z.string().max(32).optional(),
});
const text = z.object({ type: z.literal('text'), text: z.string().max(100_000), styles });
const inline = z.union([text, z.object({ type: z.literal('link'), href: z.string().max(2048), content: z.array(text).max(1000) })]);
export type Inline = z.infer<typeof inline>;
export interface DocumentBlock {
    id?: string;
    type: 'paragraph' | 'heading' | 'bulletListItem' | 'numberedListItem' | 'checkListItem' | 'quote' | 'image' | 'embed' | 'divider';
    props: Record<string, string | number | boolean | undefined>;
    content?: Inline[];
    children: DocumentBlock[];
}
const block: z.ZodType<DocumentBlock> = z.lazy(() => z.object({
    id: z.string().max(100).optional(),
    type: z.enum(['paragraph', 'heading', 'bulletListItem', 'numberedListItem', 'checkListItem', 'quote', 'image', 'embed', 'divider']),
    props: z.record(z.string().max(64), z.union([z.string().max(4096), z.number(), z.boolean(), z.undefined()])).default({}),
    content: z.array(inline).max(5000).optional(),
    children: z.array(block).max(5000).default([]),
}));

export function parseDocument(input: unknown): DocumentBlock[] {
    const serialized = JSON.stringify(input);
    if (!serialized || new TextEncoder().encode(serialized).length > MAX_DOCUMENT_BYTES) throw new DocumentValidationError('Document is too large.');
    // Check depth before the recursive schema parser, including hostile direct API input.
    let count = 0;
    const visit = (nodes: unknown, depth: number) => {
        if (!Array.isArray(nodes) || depth > 12) throw new DocumentValidationError('Invalid document nesting.');
        for (const node of nodes) {
            if (++count > 5000 || !node || typeof node !== 'object') throw new DocumentValidationError('Invalid document.');
            if ('children' in node && node.children !== undefined) visit(node.children, depth + 1);
        }
    };
    visit(input, 0);
    return z.array(block).min(1).parse(input);
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const palette: Record<string, [string, string]> = {
    gray: ['#555555', '#ebebeb'], brown: ['#795548', '#f0e5df'], red: ['#b42318', '#fee4e2'],
    orange: ['#a64b00', '#fff0db'], yellow: ['#786000', '#fff7cc'], green: ['#246b3f', '#e2f2e7'],
    blue: ['#2457a6', '#e3edfd'], purple: ['#7140a3', '#f0e4fc'], pink: ['#a02d68', '#fce3ef'],
};
function colorStyle(text: unknown, background: unknown): string {
    const color = (value: unknown, index: 0 | 1) => typeof value === 'string' ? palette[value]?.[index] ?? (/^#([a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(value) ? value : null) : null;
    const foreground = color(text, 0), fill = color(background, 1);
    return `${foreground ? `color:${foreground};` : ''}${fill ? `background-color:${fill};` : ''}`;
}
function renderInline(items: Inline[] = []): string {
    return items.map((item) => {
        if (item.type === 'link') {
            const content = renderInline(item.content);
            const href = safeUrl(item.href);
            return href ? `<a class="prose-link" href="${escape(href)}" rel="noopener noreferrer">${content}</a>` : content;
        }
        let value = escape(item.text).replace(/\n/g, '<br><br>');
        for (const [style, tag] of [['bold', 'strong'], ['italic', 'em'], ['underline', 'u'], ['strike', 's'], ['code', 'code']] as const) {
            if (item.styles[style]) value = `<${tag}>${value}</${tag}>`;
        }
        const colors = colorStyle(item.styles.textColor, item.styles.backgroundColor);
        if (colors) value = `<span style="${colors}">${value}</span>`;
        return value;
    }).join('');
}

// No HTML from an editor/client is trusted. Only these escaped semantic tags ship.
export function renderDocument(input: unknown): string {
    const render = (blocks: DocumentBlock[]): string => {
        let output = '';
        for (let index = 0; index < blocks.length; index++) {
            const block = blocks[index]!;
            const content = renderInline(block.content);
            const children = block.children.length ? render(block.children) : '';
            const align = ['left', 'center', 'right', 'justify'].includes(String(block.props.textAlignment)) ? String(block.props.textAlignment) : 'left';
            if (block.type === 'image') {
                const url = safeUrl(String(block.props.url ?? ''), true);
                const width = Number(block.props.previewWidth);
                const sizing = Number.isFinite(width) && width > 0 ? ` style="width:min(90%,${Math.min(Math.round(width), 2000)}px)"` : '';
                if (url) output += block.props.showPreview === false
                    ? `<p><a class="prose-link" href="${escape(url)}">${escape(String(block.props.caption || block.props.name || 'Image'))}</a></p>`
                    : `<div class="published-image"><img src="${escape(url)}" alt="${escape(imageAlternative(url, String(block.props.caption || block.props.name || '')))}"${sizing}>${block.props.caption ? `<p>${escape(String(block.props.caption))}</p>` : ''}</div>`;
                output += children;
            } else if (block.type === 'embed') {
                const url = embedUrl(String(block.props.url ?? ''));
                if (url) output += `<div class="embed-spotify"><iframe title="${url.includes('spotify') ? 'Spotify' : 'VideoPress'} embed" src="${escape(url)}" width="100%" height="${url.includes('spotify') ? 152 : 315}" style="border:0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
                output += children;
            } else if (block.type === 'divider') {
                output += `<hr>${children}`;
            } else if (block.type === 'bulletListItem' || block.type === 'numberedListItem' || block.type === 'checkListItem') {
                const tag = block.type === 'numberedListItem' ? 'ol' : 'ul';
                const start = Number(block.props.start);
                output += `<${tag}${tag === 'ol' && Number.isInteger(start) && start > 0 && start < 10000 ? ` start="${start}"` : ''}>`;
                let next = block;
                for (;;) {
                    const check = next.type === 'checkListItem' ? `<input type="checkbox" disabled${next.props.checked ? ' checked' : ''}> ` : '';
                    output += `<li style="${colorStyle(next.props.textColor, next.props.backgroundColor)}">${check}${renderInline(next.content)}${render(next.children)}</li>`;
                    if (blocks[index + 1]?.type !== block.type) break;
                    next = blocks[++index]!;
                }
                output += `</${tag}>`;
            } else {
                const level = Number(block.props.level);
                const tag = block.type === 'heading' ? `h${Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2}` : block.type === 'quote' ? 'blockquote' : 'p';
                output += `<${tag} style="text-align:${align};${colorStyle(block.props.textColor, block.props.backgroundColor)}">${content}</${tag}>${children}`;
            }
        }
        return output;
    };
    return render(parseDocument(input));
}
