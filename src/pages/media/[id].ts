import type { APIRoute } from 'astro';
import { z } from 'zod';
import { publicImage } from '../../lib/media-server';
import { databaseError, endpoint, HttpError, supabase } from '../../lib/server';

export const prerender = false;
export const GET: APIRoute = ({ params }) => endpoint(async () => {
    const id = z.uuid().parse(params.id);
    const { data, error } = await supabase().rpc('mybrain_public_media', { p_id: id });
    databaseError(error);
    const media = data?.[0];
    if (!media) throw new HttpError(404, 'Image not found.');
    const object = await publicImage(media.object_key);
    if (!object.Body) throw new HttpError(404, 'Image not found.');
    return new Response(object.Body.transformToWebStream() as ReadableStream, { headers: {
        'Content-Type': media.content_type, 'Content-Length': String(media.size_bytes),
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline', 'Content-Security-Policy': "default-src 'none'",
    } });
});
