import { describe, expect, it } from 'vitest';
import { embedUrl, parseDocument, renderDocument, safeUrl } from '../../src/lib/documents';
import { assembleFeed } from '../../src/lib/feed';
import { legacyEntries } from '../../src/content/legacy';
import { imageType } from '../../src/lib/media-server';
import { allRows, HttpError, readJson, requireEditor } from '../../src/lib/server';
import type { SupabaseClient } from '@supabase/supabase-js';

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text, styles: {} }] });

describe('safe public documents', () => {
    it('escapes text and rejects executable URL schemes', () => {
        const html = renderDocument([{ type: 'paragraph', content: [
            { type: 'text', text: '<script>alert(1)</script>', styles: { bold: true } },
            { type: 'link', href: 'javascript:alert(1)', content: [{ type: 'text', text: 'link', styles: {} }] },
        ] }]);
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>'); expect(html).not.toContain('href=');
        for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//evil.test', '/\\evil.test', 'https://user:pass@evil.test']) expect(safeUrl(url)).toBeNull();
        expect(safeUrl('Image 3132.png', true)).toBe('/Image%203132.png');
    });
    it('only embeds the two supported providers and canonicalizes Spotify', () => {
        expect(embedUrl('https://open.spotify.com/track/abc?si=tracking')).toBe('https://open.spotify.com/embed/track/abc');
        expect(embedUrl('https://videopress.com/embed/uxTVeCx8')).toBe('https://videopress.com/embed/uxTVeCx8');
        for (const url of ['https://open.spotify.com.evil.test/embed/track/a', 'https://evil.test/x', 'javascript:alert(1)', 'https://videopress.com:444/embed/x']) expect(embedUrl(url)).toBeNull();
    });
    it('bounds size, depth, and allowed block types', () => {
        expect(() => parseDocument([{ type: 'html', content: '<script>' }])).toThrow();
        expect(() => parseDocument([paragraph('x'.repeat(1_100_000))])).toThrow();
        let nested: unknown = [paragraph('deep')];
        for (let depth = 0; depth < 15; depth++) nested = [{ type: 'paragraph', children: nested }];
        expect(() => parseDocument(nested)).toThrow();
        expect(() => parseDocument([])).toThrow();
    });
    it('renders lists, nested blocks, formatting, and immutable media URLs', () => {
        const html = renderDocument([
            { type: 'bulletListItem', content: [{ type: 'text', text: 'one', styles: { italic: true } }] },
            { type: 'bulletListItem', content: [], children: [paragraph('nested')] },
            { type: 'image', props: { url: '/media/b1710000-0000-4000-8000-000000000099', caption: '<photo>' } },
        ]);
        expect(html).toContain('<em>one</em>'); expect(html).toContain('nested');
        expect(html).toContain('alt="&lt;photo&gt;"');
    });
    it('identifies only supported image signatures, never SVG/HTML', () => {
        expect(imageType(Buffer.from([137,80,78,71,13,10,26,10]))).toBe('image/png');
        expect(imageType(Buffer.from('GIF89a'))).toBe('image/gif');
        expect(imageType(Buffer.from('<svg onload="alert(1)">'))).toBeNull();
        expect(imageType(Buffer.from('<html>'))).toBeNull();
    });
});

describe('faithful original feed', () => {
    it('preserves all eleven entries in their seven original panels', () => {
        expect(legacyEntries).toHaveLength(11);
        expect(assembleFeed().map((group) => group.length)).toEqual([1,1,1,1,1,1,5]);
        expect(legacyEntries[7]!.html).toContain('<em>your</em>');
        expect(legacyEntries[1]!.body).toContain('https://videopress.com/embed/uxTVeCx8');
        expect(legacyEntries[7]!.body.match(/open.spotify.com/g)).toHaveLength(3);
    });
    it('keeps originals until publishing, and does not resurrect hidden entries', () => {
        const original = legacyEntries[0]!;
        const base = { id: original.id, legacy_key: original.key, group_index: 0, position: 1, title: null, document: null };
        expect(assembleFeed([{ ...base, state: 'legacy' }])[0]![0]!.legacy).toBe(true);
        expect(assembleFeed([{ ...base, state: 'hidden' }]).flat().some((entry) => entry.id === original.id)).toBe(false);
        const published = assembleFeed([{ ...base, state: 'published', title: 'Edited', document: [paragraph('new words')] }]);
        expect(published[0]![0]!.html).toContain('new words'); expect(published[0]![0]!.legacy).toBe(false);
    });
});

describe('request boundaries', () => {
    it('paginates through a configured row cap smaller than the requested page', async () => {
        const rows = [1,2,3,4,5].map((id) => ({ id }));
        const offsets: number[] = [];
        const query = { select: () => query, order: () => query, range: async (start: number) => {
            offsets.push(start); return { data: rows.slice(start, start + 2), count: rows.length, error: null };
        } };
        const client = { from: () => query } as unknown as SupabaseClient;
        expect(await allRows(client, 'mybrain_drafts', 'id')).toEqual(rows);
        expect(offsets).toEqual([0,2,4]);
    });
    it('rejects missing bearer authorization before any remote request', async () => {
        await expect(requireEditor(new Request('https://example.test/api/admin/posts'))).rejects.toMatchObject({ status: 401 });
    });
    it('rejects cross-origin writes, malformed JSON, and oversized streaming bodies', async () => {
        const request = (body: string, origin = 'https://example.test') => new Request('https://example.test/api/admin/posts', {
            method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body,
        });
        await expect(readJson(request('{}', 'https://evil.test'))).rejects.toMatchObject({ status: 403 });
        await expect(readJson(request('not json'))).rejects.toBeInstanceOf(HttpError);
        await expect(readJson(request('12345'), 4)).rejects.toMatchObject({ status: 413 });
        await expect(readJson(request('{"ok":true}'))).resolves.toEqual({ ok: true });
    });
});
