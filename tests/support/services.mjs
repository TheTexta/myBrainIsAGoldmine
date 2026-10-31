// Local-only protocol doubles. Real authorization/RLS is tested separately in
// disposable PostgreSQL. No request from this server ever leaves localhost.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const editorId = '11111111-1111-4111-8111-111111111111';
const outsiderId = '22222222-2222-4222-8222-222222222222';
const seed = [...readFileSync(new URL('../../supabase/migrations/202610300001_mybrain_publishing.sql', import.meta.url), 'utf8')
    .matchAll(/\('(b171[^']+)','([^']+)',(\d+),(\d+),'([^']+)'\)/g)]
    .map(([, id, legacy_key, group, position, title]) => ({ id, legacy_key, group_index: Number(group), position: Number(position), title, revision: 0, document: null }));
let drafts, publications, media, objects, outage;
function reset() {
    drafts = new Map(seed.map((entry) => [entry.id, structuredClone(entry)]));
    publications = new Map(seed.map((entry) => [entry.id, { ...entry, title: null, document: null, state: 'legacy' }]));
    media = new Map(); objects = new Map(); outage = false;
}
reset();
const user = (id) => ({ id, aud: 'authenticated', role: 'authenticated', email: id === editorId ? 'editor@local.test' : 'outsider@local.test', app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-01-01T00:00:00Z' });
const token = (id) => [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'test-signature'].join('.');
function identity(request) { try { return JSON.parse(Buffer.from((request.headers.authorization ?? '').split('.')[1], 'base64url').toString()).sub; } catch { return null; } }
function publicMedia(id) {
    return [...publications.values()].some((post) => post.state === 'published' && JSON.stringify(post.document).includes(`/media/${id}`)) && media.get(id)?.state === 'ready';
}
createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1:54329');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info,prefer,x-supabase-api-version');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS');
    const json = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    let body = {}; try { body = JSON.parse(bytes.toString()); } catch { /* R2 bodies are bytes. */ }
    if (url.pathname === '/health') return json({ ok: true });
    if (url.pathname === '/__reset') { reset(); return json({ ok: true }); }
    if (url.pathname === '/__outage') { outage = body.enabled; return json({ ok: true }); }
    if (url.pathname.startsWith('/r2/')) {
        const key = decodeURIComponent(url.pathname.slice('/r2/mybrain-test/'.length));
        if (request.method === 'PUT') {
            if (request.headers['if-none-match'] === '*' && objects.has(key)) { response.writeHead(412); response.end(); return; }
            objects.set(key, { bytes, type: request.headers['content-type'] });
            response.writeHead(200, { ETag: '"test-etag"' }); response.end(); return;
        }
        const object = objects.get(key);
        if (!object) { response.writeHead(404, { 'Content-Type': 'application/xml' }); response.end('<Error><Code>NoSuchKey</Code></Error>'); return; }
        response.writeHead(200, { 'Content-Type': object.type, 'Content-Length': object.bytes.length, ETag: '"test-etag"' }); response.end(object.bytes); return;
    }
    if (url.pathname === '/auth/v1/token') {
        const id = body.email === 'outsider@local.test' ? outsiderId : editorId;
        return json({ access_token: token(id), token_type: 'bearer', expires_in: 3600, refresh_token: 'test-refresh-token', user: user(id) });
    }
    if (url.pathname === '/auth/v1/logout') return json({});
    if (url.pathname === '/auth/v1/user') { const id = identity(request); return id ? json(user(id)) : json({ message: 'invalid token' }, 401); }
    const table = url.pathname.split('/').at(-1);
    const id = identity(request);
    if (table === 'mybrain_publications') {
        if (outage) return json({ message: 'offline' }, 503);
        return json([...publications.values()].filter((post) => !url.searchParams.has('id') || post.id === url.searchParams.get('id').slice(3)));
    }
    if (table === 'mybrain_public_media') return json(publicMedia(body.p_id) ? [media.get(body.p_id)] : []);
    if (table === 'mybrain_editors') return json(id === editorId ? [{ user_id: id }] : []);
    if (request.headers.authorization === 'Bearer test-service-role' && table === 'mybrain_media' && request.method === 'PATCH') {
        const row = media.get(url.searchParams.get('id')?.slice(3));
        if (row) Object.assign(row, body);
        return json(null);
    }
    if (id !== editorId) return json({ code: '42501' }, 403);
    if (table === 'mybrain_drafts') return json([...drafts.values()].filter((post) => !url.searchParams.has('id') || post.id === url.searchParams.get('id').slice(3)));
    if (table === 'mybrain_media') return json([...media.values()].filter((row) => row.id === url.searchParams.get('id')?.slice(3)));
    if (table === 'mybrain_save_draft') {
        const old = drafts.get(body.p_id);
        if ((old?.revision ?? 0) !== body.p_expected_revision) return json({ code: '40001' }, 409);
        const post = { ...old, id: body.p_id, title: body.p_title, document: body.p_document,
            legacy_key: old?.legacy_key ?? null, position: old?.position ?? -Date.now(), group_index: old?.group_index ?? null, revision: (old?.revision ?? 0) + 1 };
        drafts.set(post.id, post); return json(post);
    }
    if (table === 'mybrain_publish') {
        const post = drafts.get(body.p_id);
        if (!post || post.revision !== body.p_expected_revision) return json({ code: '40001' }, 409);
        post.revision++;
        publications.set(post.id, { ...post, state: body.p_action === 'publish' ? 'published' : 'hidden', title: body.p_action === 'publish' ? post.title : null, document: body.p_action === 'publish' ? post.document : null });
        return json({ state: body.p_action === 'publish' ? 'published' : 'hidden', revision: post.revision });
    }
    if (table === 'mybrain_reserve_media') {
        const row = { id: body.p_id, upload_key: `incoming/${body.p_id}`, object_key: `originals/${body.p_id}.png`, content_type: body.p_type, size_bytes: body.p_size, state: 'pending', sha256: null };
        media.set(row.id, row); return json(row);
    }
    return json({ message: 'unknown fixture route' }, 404);
}).listen(54329, '127.0.0.1');
