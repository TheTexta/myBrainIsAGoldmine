import type { APIRoute } from 'astro';
import { z } from 'zod';
import { parseDocument, renderDocument, type DocumentBlock } from '../../../lib/documents';
import { privateImageUrl } from '../../../lib/media-server';
import { endpoint, json, readJson, requireEditor } from '../../../lib/server';

export const prerender = false;
export const POST: APIRoute = ({ request }) => endpoint(async () => {
    const client = await requireEditor(request);
    const body = z.object({ document: z.unknown() }).parse(await readJson(request));
    const document = parseDocument(body.document);
    const resolve = async (blocks: DocumentBlock[]): Promise<void> => {
        await Promise.all(blocks.map(async (block) => {
            if (block.type === 'image') block.props.url = await privateImageUrl(client, String(block.props.url ?? ''));
            await resolve(block.children);
        }));
    };
    await resolve(document);
    return json({ html: renderDocument(document) });
});
