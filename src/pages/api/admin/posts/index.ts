import type { APIRoute } from 'astro';
import { z } from 'zod';
import { parseDocument } from '../../../../lib/documents';
import { allRows, databaseError, endpoint, json, readJson, requireEditor } from '../../../../lib/server';
import { hasUnpublishedChanges } from '../../../../lib/publication-state';

export const prerender = false;
export const GET: APIRoute = ({ request }) => endpoint(async () => {
    const client = await requireEditor(request);
    const [drafts, publications] = await Promise.all([
        allRows<{ id: string; title: string; legacy_key: string | null; revision: number; updated_at: string }>(client, 'mybrain_drafts', 'id,title,legacy_key,revision,updated_at', ['position', 'id']),
        allRows<{ id: string; state: string; published_at: string | null }>(client, 'mybrain_publications', 'id,state,published_at'),
    ]);
    const states = new Map(publications.map((post) => [post.id, post]));
    return json(drafts.map((post) => ({ ...post, state: states.get(post.id)?.state ?? 'draft',
        hasUnpublishedChanges: hasUnpublishedChanges(post.updated_at, states.get(post.id)) })));
});

const input = z.object({ id: z.uuid(), revision: z.number().int().nonnegative(), title: z.string().trim().min(1).max(200), document: z.unknown() });
export const POST: APIRoute = ({ request }) => endpoint(async () => {
    const client = await requireEditor(request);
    const body = input.parse(await readJson(request));
    const document = parseDocument(body.document);
    const { data, error } = await client.rpc('mybrain_save_draft', {
        p_id: body.id, p_expected_revision: body.revision, p_title: body.title, p_document: document,
    });
    databaseError(error);
    return json(data);
});
