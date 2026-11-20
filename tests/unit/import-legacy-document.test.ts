import { describe, expect, it, vi } from 'vitest';
import { importLegacyDocument } from '../../src/lib/import-legacy-document';
import { legacyEntries } from '../../src/content/legacy';

describe('legacy document import', () => {
    it('delegates writing to the real parser callback in media order and normalizes supported embeds', () => {
        const parser = vi.fn((html: string) => [{ type: 'parsed', html }]);
        const blocks = importLegacyDocument('<p>Before</p><iframe src="https://open.spotify.com/track/abc"></iframe><p>Middle</p><img src="Image 3132.png?size=2#old" alt="A &amp; B"><iframe src="https://videopress.com/embed/abcd"></iframe><p>After</p>', 'https://site.test', parser);
        expect(blocks).toEqual([
            { type: 'parsed', html: '<p>Before</p>' },
            { type: 'embed', props: { url: 'https://open.spotify.com/embed/track/abc' } },
            { type: 'parsed', html: '<p>Middle</p>' },
            { type: 'image', props: { url: '/Image%203132.png?size=2', name: 'A & B' } },
            { type: 'embed', props: { url: 'https://videopress.com/embed/abcd' } },
            { type: 'parsed', html: '<p>After</p>' },
        ]);
    });
    it('imports the archive’s three Spotify embeds and portable image filenames', () => {
        const blocks = legacyEntries.flatMap((entry) => importLegacyDocument(entry.html, 'https://site.test', () => []));
        const embeds = blocks.filter((block) => block.type === 'embed');
        expect(embeds.filter((block) => block.props.url.includes('spotify'))).toHaveLength(3);
        const images = blocks.filter((block) => block.type === 'image');
        expect(images).toHaveLength(20);
        expect(images.some((block) => block.props.url === '/Image%203132.png')).toBe(true);
        expect(images.every((block) => /^(\/|https?:\/\/)/.test(block.props.url))).toBe(true);
    });
    it('keeps absolute image sources, resolves relative ones, and drops unsupported players', () => {
        expect(importLegacyDocument('<img src="https://other.test/a.png#keep"><img src="//cdn.test/b.png"><img><iframe src="https://evil.test/embed"></iframe>', 'https://site.test', () => [])).toEqual([
            { type: 'image', props: { url: 'https://other.test/a.png#keep', name: '' } },
            { type: 'image', props: { url: '/b.png', name: '' } },
        ]);
    });
    it('provides an empty paragraph for empty or unsupported content, without publishing', () => {
        expect(importLegacyDocument('', 'https://site.test', () => [])).toEqual([{ type: 'paragraph' }]);
        expect(importLegacyDocument('<iframe src="https://evil.test"></iframe>', 'https://site.test', () => [])).toEqual([{ type: 'paragraph' }]);
    });
    it('propagates parser errors for the editor to report without replacing its content', () => {
        expect(() => importLegacyDocument('<p>Writing</p>', 'https://site.test', () => { throw new Error('Parser failed'); })).toThrow('Parser failed');
    });
});
