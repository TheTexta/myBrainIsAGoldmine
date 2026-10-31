import type { APIRoute } from 'astro';
import { z } from 'zod';
import { legacyEntries } from '../../../../content/legacy';
import { databaseError, endpoint, HttpError, json, requireEditor } from '../../../../lib/server';

export const prerender = false;
export const GET: APIRoute = ({ request, params }) => endpoint(async () => {
    const client = await requireEditor(request);
    const id = z.uuid().parse(params.id);
    const { data, error } = await client.from('mybrain_drafts').select('*').eq('id', id).maybeSingle();
    databaseError(error);
    if (!data) throw new HttpError(404, 'Entry not found.');
    const publication = await client.from('mybrain_publications').select('state').eq('id', id).maybeSingle();
    databaseError(publication.error);
    return json({ ...data, state: publication.data?.state ?? 'draft', legacyHtml: legacyEntries.find((post) => post.id === id)?.body ?? null });
});
