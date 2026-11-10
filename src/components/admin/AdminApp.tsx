import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { imageTypes, MAX_IMAGE_BYTES, mediaPath } from '../../lib/documents';
import publicStyles from '../../styles/public.css?url';

const DocumentEditor = lazy(() => import('./DocumentEditor'));
interface Summary { id: string; title: string; revision: number; legacy_key: string | null; state: string; hasUnpublishedChanges?: boolean; }
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
    const [preview, setPreview] = useState<string | null>(null);
    const [view, setView] = useState<'write' | 'preview'>('write');
    const [working, setWorking] = useState('');
    const [inventoryOpen, setInventoryOpen] = useState(true);
    const document = useRef<unknown>(null);
    const editVersion = useRef(0);
    const acting = useRef(false);
    const focusSelected = useRef(false);

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

    useEffect(() => {
        if (!post || !focusSelected.current) return;
        focusSelected.current = false;
        if (window.matchMedia('(max-width: 760px)').matches) window.document.getElementById('entry-title')?.focus();
    }, [post?.id, inventoryOpen]);

    async function run(action: () => Promise<void>, label = '') {
        if (acting.current) return;
        acting.current = true;
        setBusy(true); setWorking(label); setError(''); setNotice('');
        try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'The action failed. Please try again.'); }
        finally { acting.current = false; setBusy(false); setWorking(''); }
    }

    function canLeave() { return !dirty || window.confirm('Leave this entry without saving your latest changes?'); }
    function select(next: Post) {
        focusSelected.current = true;
        editVersion.current++;
        setPost(next); document.current = next.document; setDirty(false); setImportOriginal(false); setPreview(null); setView('write'); setInventoryOpen(false); setNotice('');
    }
    function changed(next: unknown) { editVersion.current++; document.current = next; setDirty(true); setPreview(null); }

    async function save(showNotice = true) {
        if (!post) return;
        const version = editVersion.current;
        const saved = await api('posts', { id: post.id, revision: post.revision, title: post.title, document: structuredClone(document.current) });
        const next = { ...post, ...saved, hasUnpublishedChanges: post.state === 'published' || post.hasUnpublishedChanges } as Post;
        setPost((current) => current?.id === next.id ? { ...next, title: version === editVersion.current ? next.title : current.title } : current);
        if (version === editVersion.current) setDirty(false);
        setPosts((current) => current.some((item) => item.id === next.id) ? current.map((item) => item.id === next.id ? next : item) : [next, ...current]);
        if (showNotice) setNotice('Draft saved. The live site has not changed.');
        return next;
    }

    async function publish() {
        if (!post) return;
        const version = editVersion.current;
        const saved = dirty || !post.revision ? await save(false) : post;
        if (!saved) return;
        if (editVersion.current !== version) throw new Error('The text changed while saving. Your draft is retained; publish again to include the latest changes.');
        let result;
        try { result = await api('publish', { id: saved.id, revision: saved.revision, action: 'publish' }); }
        catch (failure) { throw new Error(`Draft saved. Publishing could not be confirmed; check the live version before retrying. ${failure instanceof Error ? failure.message : ''}`); }
        const next = { ...saved, ...result, hasUnpublishedChanges: false } as Post;
        setPost((current) => current?.id === next.id ? { ...next, title: version === editVersion.current ? next.title : current.title } : current);
        setPosts((current) => current.map((item) => item.id === next.id ? next : item));
        setPreview(null); setView('write');
        setNotice(version === editVersion.current ? 'Published. The live site now shows this version.' : 'Published the saved version. Your newer local edits are not published yet.');
    }

    async function showPreview() {
        if (!post) return;
        const version = editVersion.current;
        const result = await api('preview', { document: structuredClone(document.current), title: post.title });
        if (version !== editVersion.current) { setNotice('The draft changed while the preview loaded. Preview again for the latest version.'); return; }
        setPreview(previewPage(result.html, post.title)); setView('preview');
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
        return `<!doctype html><html><head><base href="${escape(window.location.origin)}/"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${escape(publicStyles)}"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap"><title>${escape(title)}</title></head><body><div class="content preview-content tinos-regular"><h1 class="title tinos-regular">${escape(title)}</h1>${html}</div></body></html>`;
    }

    const live = post?.state === 'published' || post?.state === 'legacy';
    const canWrite = Boolean(post?.title.trim() && document.current);
    const status = working || (uploads ? `Uploading ${uploads} image${uploads === 1 ? '' : 's'}…` : dirty ? 'Unsaved changes'
        : post?.state === 'published' ? post.hasUnpublishedChanges ? 'Draft saved · changes not published' : 'Live · all changes published'
        : post?.state === 'legacy' ? post.revision ? 'Original live · draft saved' : 'Original live'
        : post?.state === 'hidden' ? 'Unpublished · draft retained' : post?.revision ? 'Draft saved · not on site' : 'Not saved yet');

    return <div className="admin-app">
        <header className="admin-header"><a className="admin-link" href="/">My brain is a goldmine</a><h1>Publishing</h1>
            {session && <button className="admin-button" disabled={busy || uploads > 0} onClick={() => {
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
            <h2 className="admin-heading">Sign in to write</h2><p className="admin-copy">Use your existing Supabase account. Access must be granted specifically for this site.</p>
            <label className="admin-label" htmlFor="email">Email</label><input className="admin-input" id="email" name="email" type="email" autoComplete="username" required />
            <label className="admin-label" htmlFor="password">Password</label><input className="admin-input" id="password" name="password" type="password" autoComplete="current-password" required />
            <button className="admin-button" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form> : !authorized ? <p role="status">{error ? 'Sign out to use a different account, or ask the site owner to check your access.' : 'Checking editorial access…'}</p> : <div className="workspace">
            <aside className="entry-list" aria-label="Entries" data-collapsed={Boolean(post && !inventoryOpen)}>
                <div className="entry-list-header"><h2 className="admin-heading">Entries</h2>
                    {post && <button className="admin-button inventory-toggle" aria-expanded={inventoryOpen} aria-controls="entry-inventory" onClick={() => setInventoryOpen((open) => !open)}>{inventoryOpen ? 'Hide entries' : 'Choose entry'}</button>}</div>
                <div id="entry-inventory">
                <button className="admin-button" disabled={busy || uploads > 0} onClick={() => {
                    if (canLeave()) select({ id: crypto.randomUUID(), title: '', revision: 0, legacy_key: null, state: 'draft', document: [{ type: 'paragraph' }], legacyHtml: null });
                }}>New entry</button>
                <ul>{posts.map((item) => <li key={item.id}><button className="admin-button" aria-current={item.id === post?.id ? 'true' : undefined} disabled={busy || uploads > 0} onClick={() => {
                    if (canLeave()) void run(async () => select(await api(`posts/${item.id}`)));
                }}><span>{item.title}</span><small>{item.state === 'legacy' ? 'Original live' : item.state === 'published' ? item.hasUnpublishedChanges ? 'Published · newer draft' : 'Published' : item.state === 'hidden' ? 'Unpublished' : 'Draft'}</small></button></li>)}</ul>
                </div>
            </aside>
            <main className="writing-area">{!post ? <div className="editor-empty"><h2 className="admin-heading">Choose an entry, or start a new one.</h2><p className="admin-copy">Save drafts privately, or publish when you are ready. Preview is optional.</p></div> : <>
                <label className="admin-label" htmlFor="entry-title">Title</label><input className="admin-input" id="entry-title" value={post.title} disabled={busy} maxLength={200} onChange={(event) => { editVersion.current++; setPost({ ...post, title: event.target.value }); setDirty(true); setPreview(null); setView('write'); }} />
                <div className="publishing-actions">
                    <span role="status">{status}</span>
                    <button className="admin-button" disabled={busy || uploads > 0 || !canWrite || (!dirty && post.revision > 0)} onClick={() => void run(async () => { await save(); }, 'Saving…')}>Save draft</button>
                    <button className="admin-button primary" disabled={busy || uploads > 0 || !canWrite} onClick={() => void run(publish, 'Publishing…')}>{live ? 'Update live post' : 'Publish'}</button>
                    {live && <details className="publication-more"><summary>More</summary><button className="admin-button" disabled={busy || uploads > 0 || dirty} onClick={() => {
                        if (window.confirm('Remove this entry from the live site? Your saved draft and images will be retained.')) void run(async () => {
                            const result = await api('publish', { id: post.id, revision: post.revision, action: 'hide' });
                            setPost({ ...post, ...result, hasUnpublishedChanges: false }); setPosts((current) => current.map((item) => item.id === post.id ? { ...item, ...result, hasUnpublishedChanges: false } : item)); setPreview(null); setView('write');
                            setNotice('Unpublished. Your saved draft is retained.');
                        }, 'Unpublishing…');
                    }}>Unpublish</button>{dirty && <p className="admin-copy">Save your draft before unpublishing.</p>}</details>}
                </div>
                {(uploads > 0 || !canWrite) && <p className="publishing-help admin-copy">{uploads ? 'Finish uploading before saving or publishing.' : !post.title.trim() ? 'Add a title to save or publish.' : 'Import the original to start editing.'}</p>}
                <nav className="editor-views" aria-label="Editor view">
                    <button className="admin-button" aria-pressed={view === 'write'} disabled={busy} onClick={() => setView('write')}>Write</button>
                    <button className="admin-button" aria-pressed={view === 'preview'} disabled={busy || uploads > 0 || !canWrite} onClick={() => void run(showPreview, 'Loading preview…')}>Preview</button>
                </nav>
                {view === 'write' ? !document.current && !importOriginal ? <div className="original-notice"><h2 className="admin-heading">{post.state === 'legacy' ? 'The original is still live.' : 'The original is retained.'}</h2><p className="admin-copy">Import it into BlockNote to edit. Importing can simplify galleries, spacing, and formatting; nothing changes publicly until you publish.</p>
                    <button className="admin-button" onClick={() => setImportOriginal(true)}>Import original into BlockNote</button></div> : <Suspense fallback={<p className="admin-copy" role="status">Loading BlockNote…</p>}>
                    <DocumentEditor key={post.id} initialContent={document.current} legacyHtml={post.legacyHtml} disabled={busy} onChange={changed} onError={setError} uploadFile={uploadFile}
                        resolveFileUrl={async (value) => mediaPath.test(value) ? (await api(`media/${value.slice(7)}`)).url : value} />
                </Suspense> : preview && <section className="preview"><h2 className="admin-heading">Preview</h2><p className="admin-copy">Preview does not save or publish. Return to Write to keep editing, or publish directly above.</p>
                    <iframe title="Post preview" sandbox="allow-scripts" srcDoc={preview} /></section>}
            </>}</main>
        </div>}
    </div>;
}
