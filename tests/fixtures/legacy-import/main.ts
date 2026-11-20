import { BlockNoteEditor, BlockNoteSchema, createBlockSpec, defaultBlockSpecs } from '@blocknote/core';
import { legacyEntries } from '../../../src/content/legacy';
import { importLegacyDocument } from '../../../src/lib/import-legacy-document';
import { importLegacyWithDOMParser } from '../../support/legacy-import-reference';

// The application's supported schema, with a DOM-only renderer for its leaf
// embed block. Rendering UI is irrelevant to the HTML parser/document comparison.
const embed = createBlockSpec({ type: 'embed', propSchema: { url: { default: '' } }, content: 'none' }, {
    render: () => ({ dom: document.createElement('div') }),
});
const schema = BlockNoteSchema.create({ blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph, heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem, numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem, quote: defaultBlockSpecs.quote,
    image: defaultBlockSpecs.image, divider: defaultBlockSpecs.divider, embed: embed(),
} });

export const adversarialFixtures = [
    { name: 'malformed nested writing and media', html: '<h2>Heading<p>First <b>bold<i>mixed</b> tail</i><div><p>Second<img src="nested photo.png" alt="Nested"><p>Third</div><ul><li>One<li>Two<ul><li>Deep</ul></ul><iframe src="https://open.spotify.com/track/abc"></iframe><p>Last' },
    { name: 'table repair and nested gallery', html: '<div>Start<table><tr><td>Cell one<td><p>Cell two<img src="table.png"></table>After<div><figure><a href="/link"><img src="gallery.png" alt="Gallery"></a><figcaption>Caption</figcaption></figure></div>End</div>' },
    { name: 'entities and portable sources', html: '<p>A &amp; B &lt;tag&gt; &quot;quoted&quot; &#39;apostrophe&#39; &nbsp; &#x1f41f; &copy;</p><img src="folder/a b.png?x=1&amp;y=2#fragment" alt="Fish &amp; chips &quot;yes&quot;"><iframe src="https://open.spotify.com/embed/album/abc?utm_source=x&amp;theme=0"></iframe><p>Final &notin; &notit;</p>' },
    { name: 'inert scripts and noscript', html: '<!doctype html><html><head><title>Not writing</title><script>globalThis.__legacyImportExecuted = true;</script><noscript><p>Head fallback</p></noscript></head><body><p>Before script</p><script>globalThis.__legacyImportExecuted = true; "<img src=script.png>";</script><noscript><p>Fallback &amp; writing</p><img src="fallback image.png" alt="Fallback"></noscript><p>After fallback</p></body></html>' },
    { name: 'inert template and unsupported iframe', html: '<p>Visible</p><template><p>Template writing<img src="template image.png"></p></template><iframe src="https://unsupported.test/embed">Ignored</iframe><iframe src="https://videopress.com/embed/abcd"></iframe><p>After players</p>' },
    { name: 'empty and whitespace', html: ' \n <!-- no writing --> ' },
];

// Only generated IDs differ between independent BlockNote parser/editor runs.
function withoutIds(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(withoutIds);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id').map(([key, item]) => [key, withoutIds(item)]));
    return value;
}
function orderedContent(blocks: unknown): unknown[] {
    const ordered: unknown[] = [];
    function visit(value: unknown) {
        if (Array.isArray(value)) { value.forEach(visit); return; }
        if (!value || typeof value !== 'object') return;
        const block = value as { type?: string; text?: string; props?: { url?: string; name?: string }; content?: unknown; children?: unknown };
        if (block.type === 'text') ordered.push({ text: block.text });
        if (block.type === 'image' || block.type === 'embed') ordered.push({ type: block.type, ...block.props });
        if (block.content) visit(block.content);
        if (block.children) visit(block.children);
    }
    visit(blocks); return ordered;
}

function compare(html: string) {
    function run(convert: typeof importLegacyDocument) {
        const editor = BlockNoteEditor.create({ schema });
        const fragments: string[] = [];
        const parsed = convert(html, window.location.origin, (fragment) => {
            fragments.push(fragment);
            return editor.tryParseHTMLToBlocks(fragment);
        });
        editor.replaceBlocks(editor.document, parsed);
        return { fragments, blocks: withoutIds(editor.document), ordered: orderedContent(editor.document) };
    }
    return { reference: run(importLegacyWithDOMParser), extracted: run(importLegacyDocument) };
}

declare global {
    interface Window {
        legacyImportDifferential: {
            cases: { name: string; html: string }[];
            compare: typeof compare;
        };
        __legacyImportExecuted?: boolean;
    }
}
window.legacyImportDifferential = {
    cases: [...legacyEntries.map((entry, index) => ({ name: `archive ${index + 1}: ${entry.title}`, html: entry.html })), ...adversarialFixtures],
    compare,
};
