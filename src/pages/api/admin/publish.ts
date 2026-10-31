import type { APIRoute } from 'astro';
import { z } from 'zod';
import { databaseError, endpoint, json, readJson, requireEditor } from '../../../lib/server';

export const prerender = false;
const input = z.object({ id: z.uuid(), revision: z.number().int().nonnegative(), action: z.enum(['publish', 'hide']) });
export const POST: APIRoute = ({ request }) => endpoint(async () => {
    const client = await requireEditor(request);
    const body = input.parse(await readJson(request, 4096));
    const { data, error } = await client.rpc('mybrain_publish', { p_id: body.id, p_expected_revision: body.revision, p_action: body.action });
    databaseError(error);
    return json(data);
});
