import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { DocumentValidationError } from './documents';

export class HttpError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

export function publicConfig() {
    const url = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
    const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;
    return url && key ? { url, key } : null;
}

export function supabase(token?: string): SupabaseClient {
    const config = publicConfig();
    if (!config) throw new HttpError(503, 'Publishing is not configured yet.');
    return createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });
}

export function privilegedSupabase(): SupabaseClient {
    const config = publicConfig();
    const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!config || !key) throw new HttpError(503, 'Image uploads are not configured yet.');
    return createClient(config.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireEditor(request: Request): Promise<SupabaseClient> {
    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!token) throw new HttpError(401, 'Sign in to continue.');
    const client = supabase(token);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, 'Your session expired. Sign in again; your open draft has not been discarded.');
    const membership = await client.from('mybrain_editors').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (membership.error) throw new HttpError(503, 'Editorial access could not be checked. Try again.');
    if (!membership.data) throw new HttpError(403, 'This account does not have editorial access to this site.');
    return client;
}

export async function readJson(request: Request, limit = 1_100_000): Promise<unknown> {
    if (request.headers.get('origin') !== new URL(request.url).origin) throw new HttpError(403, 'Same-origin requests are required.');
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Send a JSON request.');
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Request body is missing.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > limit) { await reader.cancel(); throw new HttpError(413, 'This document is too large.'); }
        chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new HttpError(400, 'Invalid JSON request.'); }
}

export function databaseError(error: { code?: string } | null) {
    if (!error) return;
    if (error.code === '40001' || error.code === '23505') throw new HttpError(409, 'This draft changed elsewhere. Keep your open text, then reload the saved version before trying again.');
    if (error.code === '42501') throw new HttpError(403, 'Editorial access is required.');
    if (error.code === '23514') throw new HttpError(400, 'The draft or an image is not ready to publish. Save it and finish uploads first.');
    if (error.code === 'P0002') throw new HttpError(404, 'Entry not found.');
    throw new HttpError(503, 'The publishing service could not complete that action. Your open draft is unchanged.');
}

export async function allRows<T>(client: SupabaseClient, table: 'mybrain_drafts' | 'mybrain_publications', columns: string, orders = ['id']): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ;) {
        let query = client.from(table).select(columns, { count: 'exact' });
        for (const column of orders) query = query.order(column);
        const page = await query.range(offset, offset + 499);
        databaseError(page.error);
        const batch = page.data as unknown as T[];
        if (!batch.length) {
            if (page.count !== null && offset < page.count) throw new HttpError(503, 'The entry inventory is incomplete. Try again.');
            break;
        }
        rows.push(...batch);
        offset += batch.length;
        if (page.count !== null ? offset >= page.count : batch.length < 500) break;
    }
    return rows;
}

export function json(value: unknown, status = 200): Response {
    return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function endpoint(action: () => Promise<Response>): Promise<Response> {
    try { return await action(); }
    catch (error) {
        if (error instanceof HttpError) return json({ error: error.message }, error.status);
        if (error instanceof ZodError || error instanceof DocumentValidationError) return json({ error: 'The document or request is invalid or too large. Check it and try again.' }, 400);
        return json({ error: 'The service is temporarily unavailable. Keep your draft open and try again.' }, 503);
    }
}
