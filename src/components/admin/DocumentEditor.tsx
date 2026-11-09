import { useEffect, useState } from 'react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { createReactBlockSpec, useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { embedUrl } from '../../lib/documents';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

const createEmbed = createReactBlockSpec({
    type: 'embed', propSchema: { url: { default: '' } }, content: 'none',
}, {
    render: ({ block }) => <div className="editor-embed" contentEditable={false}>
        <strong>{embedUrl(block.props.url)?.includes('spotify') ? 'Spotify' : 'VideoPress'} embed</strong>
        <span>{block.props.url}</span>
    </div>,
});

const schema = BlockNoteSchema.create({ blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph, heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem, numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem, quote: defaultBlockSpecs.quote,
    image: defaultBlockSpecs.image, divider: defaultBlockSpecs.divider, embed: createEmbed(),
} });

interface Props {
    initialContent: unknown;
    legacyHtml: string | null;
    disabled: boolean;
    onChange: (document: unknown) => void;
    uploadFile: (file: File) => Promise<string>;
    resolveFileUrl: (url: string) => Promise<string>;
    onError: (message: string) => void;
}

export default function DocumentEditor({ initialContent, legacyHtml, disabled, onChange, uploadFile, resolveFileUrl, onError }: Props) {
    const [embed, setEmbed] = useState('');
    const [importing, setImporting] = useState(Boolean(legacyHtml && !initialContent));
    const editor = useCreateBlockNote({ schema,
        initialContent: initialContent ? initialContent as typeof schema.PartialBlock[] : undefined,
        uploadFile, resolveFileUrl,
    });

    useEffect(() => {
        if (!legacyHtml || initialContent) return;
        let cancelled = false;
        const importOriginal = async () => {
            // Preserve the existing players as explicit supported blocks. HTML
            // import itself is lossy, so the original stays public until Publish.
            const original = new DOMParser().parseFromString(legacyHtml, 'text/html');
            original.querySelectorAll('img').forEach((image) => {
                const source = image.getAttribute('src');
                if (source && !/^https?:\/\//i.test(source)) {
                    const url = new URL(source, window.location.origin);
                    image.setAttribute('src', `${url.pathname}${url.search}`);
                }
            });
            const chunks = original.body.innerHTML.split(/(<iframe\b[^>]*>[\s\S]*?<\/iframe>|<img\b[^>]*>)/gi);
            const blocks: typeof schema.PartialBlock[] = [];
            for (const chunk of chunks) {
                if (/^<iframe\b/i.test(chunk)) {
                    const element = new DOMParser().parseFromString(chunk, 'text/html').querySelector('iframe');
                    const url = embedUrl(element?.getAttribute('src') ?? '');
                    if (url) blocks.push({ type: 'embed', props: { url } });
                } else if (/^<img\b/i.test(chunk)) {
                    const image = new DOMParser().parseFromString(chunk, 'text/html').querySelector('img');
                    const url = image?.getAttribute('src');
                    if (url) blocks.push({ type: 'image', props: { url, name: image?.getAttribute('alt') ?? '' } });
                } else if (chunk.trim()) blocks.push(...editor.tryParseHTMLToBlocks(chunk));
            }
            if (cancelled) return;
            editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: 'paragraph' }]);
            onChange(editor.document);
            setImporting(false);
        };
        void importOriginal().catch(() => { if (!cancelled) { onError('The original could not be imported. Reload this entry to try again; the live version is unchanged.'); setImporting(false); } });
        return () => { cancelled = true; };
        // Each entry mounts its own editor; imported content is initialized once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor]);

    return <>
        <details className="editor-tools">
        <summary>Images and embeds</summary>
        <label className="admin-label image-upload" htmlFor="image-upload">Upload image
            <input className="admin-input" id="image-upload" type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={disabled || importing} onChange={async (event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (!file) return;
                try {
                    const url = await uploadFile(file);
                    editor.insertBlocks([{ type: 'image', props: { url, name: file.name } }], editor.document.at(-1)!, 'after');
                    onChange(editor.document);
                } catch (failure) { onError(failure instanceof Error ? failure.message : 'The upload failed. Try again.'); }
            }} />
        </label>
        <form className="embed-form" onSubmit={(event) => {
            event.preventDefault();
            const url = embedUrl(embed);
            if (!url) { onError('Use a Spotify track, album, playlist, episode, or VideoPress embed URL.'); return; }
            editor.insertBlocks([{ type: 'embed', props: { url } }], editor.getTextCursorPosition().block, 'after');
            setEmbed(''); onChange(editor.document); editor.focus();
        }}>
            <label className="admin-label" htmlFor="embed-url">Music or video URL</label>
            <div><input className="admin-input" id="embed-url" type="url" value={embed} disabled={disabled || importing} onChange={(event) => setEmbed(event.target.value)} placeholder="Spotify or VideoPress" />
                <button className="admin-button" type="submit" disabled={disabled || importing || !embed}>Insert embed</button></div>
        </form>
        </details>
        {importing && <p className="admin-copy" role="status">Importing the original writing…</p>}
        <BlockNoteView editor={editor} theme="light" editable={!importing && !disabled} onChange={() => onChange(editor.document)} />
    </>;
}
