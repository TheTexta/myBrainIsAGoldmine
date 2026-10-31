import type { APIRoute } from 'astro';
import { z } from 'zod';
import { completeUpload, getMedia, privateImageUrl } from '../../../../lib/media-server';
import { endpoint, json, readJson, requireEditor } from '../../../../lib/server';

export const prerender = false;
export const GET: APIRoute = ({ request, params }) => endpoint(async () => {
    const client = await requireEditor(request);
    const id = z.uuid().parse(params.id);
    return json({ url: await privateImageUrl(client, `/media/${id}`) });
});
export const POST: APIRoute = ({ request, params }) => endpoint(async () => {
    const client = await requireEditor(request);
    await readJson(request, 4096);
    const id = z.uuid().parse(params.id);
    await completeUpload(await getMedia(client, id));
    return json({ url: `/media/${id}` });
});
