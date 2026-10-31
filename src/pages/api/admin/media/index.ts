import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { imageTypes, MAX_IMAGE_BYTES } from '../../../../lib/documents';
import { uploadUrl, type Media } from '../../../../lib/media-server';
import { databaseError, endpoint, json, readJson, requireEditor } from '../../../../lib/server';

export const prerender = false;
const input = z.object({ size: z.number().int().min(1).max(MAX_IMAGE_BYTES), type: z.enum(imageTypes) });
export const POST: APIRoute = ({ request }) => endpoint(async () => {
    const client = await requireEditor(request);
    const body = input.parse(await readJson(request, 4096));
    const { data, error } = await client.rpc('mybrain_reserve_media', { p_id: randomUUID(), p_size: body.size, p_type: body.type });
    databaseError(error);
    const media = data as Media;
    return json({ id: media.id, url: await uploadUrl(media) });
});
