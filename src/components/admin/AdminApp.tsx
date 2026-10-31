import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { imageTypes, MAX_IMAGE_BYTES, mediaPath } from '../../lib/documents';

const DocumentEditor = lazy(() => import('./DocumentEditor'));
interface Summary { id: string; title: string; revision: number; legacy_key: string | null; state: string; }
interface Post extends Summary { document: unknown; legacyHtml: string | null; }
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export default function AdminApp({ url, anonKey }: { url: string; anonKey: string }) {
    const [client] = useState(() => createClient(url, anonKey));
    const [session, setSession] = useState<Session | null>(null);
    const [restoring, setRestoring] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const [posts, setPosts] = useState<Summary[]>([]);
    const [post, setPost] = useState<Post | null>(null);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [uploads, setUploads] = useState(0);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [importOriginal, setImportOriginal] = useState(false);
    const [preview, setPreview] = useState<{ html: string; revision: number } | null>(null);
    const document = useRef<unknown>(null);

    async function api(path: string, body?: unknown) {
        const { data } = await client.auth.getSession();
        if (!data.session) throw new Error('Your session expired. Sign in again; keep this page open to retain your text.');
        const response = await fetch(`/api/admin/${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: { Authorization: `Bearer ${data.session.access_token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'The action failed. Keep the draft open and try again.');
        return result;
    }

    useEffect(() => {
        let active = true;
        void client.auth.getSession().then(({ data }) => { if (active) { setSession(data.session); setRestoring(false); } });
        const { data } = client.auth.onAuthStateChange((_event, next) => {
            if (!active) return;
            if (!next) setPost((current) => current ? { ...current, document: document.current } : null);
            setSession(next);
        });
        return () => { active = false; data.subscription.unsubscribe(); };
    }, [client]);

    useEffect(() => {
        if (!session) { setAuthorized(false); return; }
        let active = true;
        void api('posts').then((result) => { if (active) { setPosts(result); setAuthorized(true); setError(''); } })
            .catch((failure: Error) => { if (active) setError(failure.message); });
        return () => { active = false; };
        // Token refresh does not reload or replace an open draft.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.user.id]);

    useEffect(() => {
        if (!dirty && !uploads) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty, uploads]);

    async function run(action: () => Promise<void>) {
        setBusy(true); setError(''); setNotice('');
        try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'The action failed. Please try again.'); }
        finally { setBusy(false); }
    }

    function canLeave() { return !dirty || window.confirm('Leave this entry without saving your latest changes?'); }
    function select(next: Post) {
        setPost(next); document.current = next.document; setDirty(false); setImportOriginal(false); setPreview(null); setNotice('');
    }
    function changed(next: unknown) { document.current = next; setDirty(true); setPreview(null); }

    async function save() {
        if (!post) return;
        const saved = await api('posts', { id: post.id, revision: post.revision, title: post.title, document: document.current });
        const next = { ...post, ...saved } as Post;
        setPost(next); setDirty(false);
        setPosts((current) => current.some((item) => item.id === next.id) ? current.map((item) => item.id === next.id ? next : item) : [next, ...current]);
        setNotice('Draft saved. The live site has not changed.');
        return next;
    }

    async function uploadFile(file: File): Promise<string> {
        if (!(imageTypes as readonly string[]).includes(file.type) || !file.size || file.size > MAX_IMAGE_BYTES) throw new Error('Choose a JPEG, PNG, GIF, or WebP image up to 20 MB.');
        setUploads((count) => count + 1); setError('');
        try {
            const reservation = await api('media', { size: file.size, type: file.type });
            const uploaded = await fetch(reservation.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type }, credentials: 'omit' });
            if (!uploaded.ok) throw new Error('The upload failed. Check your connection and try again.');
            const completed = await api(`media/${reservation.id}`, {});
            return completed.url;
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'The upload failed. Try again.'); throw failure; }
        finally { setUploads((count) => count - 1); }
    }

    function previewPage(html: string, title: string) {
        return `<!doctype html><html><head><base href="${escape(window.location.origin)}/"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap"><style>.prose-link{display:inline;width:auto;margin:0;border:0;font:inherit;text-decoration:underline}.content{margin-top:2rem}</style></head><body><div class="content tinos-regular"><h1 class="title tinos-regular">${escape(title)}</h1>${html}</div></body></html>`;
    }

    return <div className="admin-app">
        <header className="admin-header"><a href="/">My brain is a goldmine</a><h1>Publishing</h1>
            {session && <button disabled={busy || uploads > 0} onClick={() => {
                if (canLeave()) void run(async () => {
                    const { error } = await client.auth.signOut();
                    if (error) throw new Error('Sign-out failed. Please try again.');
                    setPost(null); document.current = null; setDirty(false); setPreview(null); setPosts([]);
                });
            }}>Sign out</button>}</header>
        {error && <div className="admin-message error" role="alert">{error}</div>}
        {notice && <div className="admin-message" role="status">{notice}</div>}
        {restoring ? <p role="status">Restoring your session…</p> : !session ? <form className="login-form" onSubmit={(event) => {
            event.preventDefault(); const form = new FormData(event.currentTarget);
            void run(async () => {
                const result = await client.auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) });
                if (result.error) throw new Error('Sign-in failed. Check your email and password, then try again.');
            });
        }}>
            <h2>Sign in to write</h2><p>Use your existing Supabase account. Access must be granted specifically for this site.</p>
            <label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required />
            <label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required />
            <button disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form> : !authorized ? <p role="status">{error ? 'Sign out to use a different account, or ask the site owner to check your access.' : 'Checking editorial access…'}</p> : <div className="workspace">
            <aside className="entry-list" aria-label="Entries"><h2>Entries</h2>
                <button disabled={busy || uploads > 0} onClick={() => {
                    if (canLeave()) select({ id: crypto.randomUUID(), title: '', revision: 0, legacy_key: null, state: 'draft', document: [{ type: 'paragraph' }], legacyHtml: null });
                }}>New entry</button>
                <ul>{posts.map((item) => <li key={item.id}><button aria-current={item.id === post?.id ? 'true' : undefined} disabled={busy || uploads > 0} onClick={() => {
                    if (canLeave()) void run(async () => select(await api(`posts/${item.id}`)));
                }}><span>{item.title}</span><small>{item.state === 'legacy' ? 'Original live' : item.state === 'published' ? 'Published' : item.state === 'hidden' ? 'Unpublished' : 'Draft'}</small></button></li>)}</ul>
            </aside>
            <main className="writing-area">{!post ? <div className="editor-empty"><h2>Choose an entry, or start a new one.</h2><p>Saving a draft never changes the live site. Preview and publish when you are ready.</p></div> : <>
                <label htmlFor="entry-title">Title</label><input id="entry-title" value={post.title} disabled={busy} maxLength={200} onChange={(event) => { setPost({ ...post, title: event.target.value }); setDirty(true); setPreview(null); }} />
                <div className="publishing-actions">
                    <span role="status">{uploads ? `Uploading ${uploads} image${uploads === 1 ? '' : 's'}…` : dirty ? 'Unsaved changes' : post.revision ? 'Draft saved' : 'Not saved yet'}</span>
                    <button disabled={busy || uploads > 0 || !post.title.trim() || (!post.document && !importOriginal)} onClick={() => void run(async () => { await save(); })}>Save draft</button>
                    <button disabled={busy || uploads > 0 || !post.title.trim() || (!post.document && !importOriginal)} onClick={() => void run(async () => {
                        const saved = dirty || !post.revision ? await save() : post;
                        if (!saved) return;
                        const result = await api('preview', { document: document.current });
                        setPreview({ html: previewPage(result.html, saved.title), revision: saved.revision });
                        setNotice('Preview ready. Review the layout below before publishing.');
                    })}>Preview</button>
                    <button className="primary" disabled={busy || uploads > 0 || dirty || !preview || preview.revision !== post.revision} onClick={() => void run(async () => {
                        const result = await api('publish', { id: post.id, revision: post.revision, action: 'publish' });
                        setPost({ ...post, ...result }); setPosts((current) => current.map((item) => item.id === post.id ? { ...item, ...result } : item)); setPreview(null);
                        setNotice('Published. The live site now shows this version.');
                    })}>Publish</button>
                    {(post.state === 'published' || post.state === 'legacy') && <button disabled={busy || uploads > 0 || dirty} onClick={() => {
                        if (window.confirm('Remove this entry from the live site? Your saved draft and images will be retained.')) void run(async () => {
                            const result = await api('publish', { id: post.id, revision: post.revision, action: 'hide' });
                            setPost({ ...post, ...result }); setPosts((current) => current.map((item) => item.id === post.id ? { ...item, ...result } : item)); setPreview(null);
                            setNotice('Unpublished. Your saved draft is retained.');
                        });
                    }}>Unpublish</button>}
                </div>
                {!post.document && !importOriginal ? <div className="original-notice"><h2>{post.state === 'legacy' ? 'The original is still live.' : 'The original is retained.'}</h2><p>Import it into BlockNote to edit. Importing can simplify galleries, spacing, and formatting; nothing changes publicly until you preview and publish.</p>
                    <button onClick={() => setImportOriginal(true)}>Import original into BlockNote</button></div> : <Suspense fallback={<p role="status">Loading BlockNote…</p>}>
                    <DocumentEditor key={post.id} initialContent={post.document} legacyHtml={post.legacyHtml} disabled={busy} onChange={changed} onError={setError} uploadFile={uploadFile}
                        resolveFileUrl={async (value) => mediaPath.test(value) ? (await api(`media/${value.slice(7)}`)).url : value} />
                </Suspense>}
                {preview && <section className="preview"><h2>Saved draft preview</h2><p>This is a preview, not the live site. Embedded players may require opening the published page.</p>
                    <iframe title="Saved draft preview" sandbox="allow-scripts" srcDoc={preview.html} /></section>}
            </>}</main>
        </div>}
    </div>;
}
