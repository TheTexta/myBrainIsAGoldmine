import { describe, expect, it } from 'vitest';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { accessiblePostMarkup, imageAlternative } from '../../src/lib/content-accessibility';
import { legacyEntries } from '../../src/content/legacy';
import { renderDocument } from '../../src/lib/documents';
import { hasUnpublishedChanges } from '../../src/lib/publication-state';

describe('accessible post presentation', () => {
    it('provides meaningful descriptions and titles without editing the archive', () => {
        let count = 0;
        for (const entry of legacyEntries) {
            const markup = accessiblePostMarkup(entry.html, entry.title);
            const visit = (node: DefaultTreeAdapterMap['node']) => {
                if ('tagName' in node && node.tagName === 'img') {
                    const alt = node.attrs.find((attribute) => attribute.name === 'alt')?.value;
                    expect(alt?.length).toBeGreaterThan(10);
                    expect(alt).not.toMatch(/\b(?:image|photo|picture)\b/i);
                    count++;
                }
                if ('tagName' in node && node.tagName === 'iframe') expect(node.attrs.find((attribute) => attribute.name === 'title')?.value.trim()).toBeTruthy();
                if ('childNodes' in node) node.childNodes.forEach(visit);
            };
            parseFragment(markup).childNodes.forEach(visit);
        }
        expect(count).toBe(20);
        expect(legacyEntries[1].html).not.toContain('Media player —');
    });
    it('resolves portable source descriptions and removes redundant caption prefixes', () => {
        expect(imageAlternative('/Image%203132.png', 'Image 3132.png')).toContain('unreturned love');
        expect(imageAlternative('https://example.test/new.jpg', 'Photo of a forest')).toBe('a forest');
        expect(imageAlternative('https://example.test/new.jpg', 'A forest')).toBe('A forest');
        expect(imageAlternative('https://example.test/new.jpg', 'new.jpg')).toBe('');
    });
    it('double-spaces intentional breaks without changing stored text', () => {
        const document = [{ type: 'paragraph', content: [{ type: 'text', text: 'First\nSecond', styles: {} }] }];
        expect(renderDocument(document)).toContain('First<br><br>Second');
        expect(document[0].content[0].text).toBe('First\nSecond');
    });
});

describe('publication status', () => {
    it('distinguishes a later saved draft from the live version', () => {
        const publication = { state: 'published', published_at: '2026-01-01T00:00:00.123456+00:00' };
        expect(hasUnpublishedChanges(publication.published_at, publication)).toBe(false);
        expect(hasUnpublishedChanges('2026-01-01T00:00:01.123456+00:00', publication)).toBe(true);
        expect(hasUnpublishedChanges('2026-01-01T00:00:00.123457+00:00', publication)).toBe(true);
        expect(hasUnpublishedChanges('2025-01-01T00:00:00Z', publication)).toBe(false);
        expect(hasUnpublishedChanges('2026-01-01T00:00:01Z', { state: 'hidden', published_at: publication.published_at })).toBe(false);
    });
});
