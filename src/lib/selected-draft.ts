export type PublicationState = 'draft' | 'legacy' | 'published' | 'hidden';
export interface Summary { id: string; title: string; revision: number; legacy_key: string | null; state: PublicationState; hasUnpublishedChanges?: boolean; }
export interface Post extends Summary { document: unknown; legacyHtml: string | null; }
type Request = (path: string, body: unknown) => Promise<Partial<Post>>;

// The editor's frequently changing document stays outside the render snapshot.
// A selection generation also distinguishes leaving and returning to the same ID.
// The UI serializes save/publish/hide commands; edits may arrive during any await.
export function createSelectedDraft(request: Request) {
    let snapshot: { post: Post | null; dirty: boolean; posts: Summary[] } = { post: null, dirty: false, posts: [] };
    let document: unknown = null;
    let version = 0, selection = 0;
    function inventory(next: Post) {
        const posts = snapshot.posts.some((item) => item.id === next.id)
            ? snapshot.posts.map((item) => item.id === next.id ? next : item) : [next, ...snapshot.posts];
        snapshot = { ...snapshot, posts };
    }
    function acknowledge(next: Post, generation: number, sentVersion: number, saved: boolean) {
        inventory(next);
        if (generation !== selection) return;
        const unchanged = sentVersion === version;
        snapshot = { ...snapshot, post: { ...next, title: unchanged ? next.title : snapshot.post!.title },
            dirty: saved && unchanged ? false : snapshot.dirty };
    }
    async function save() {
        const post = snapshot.post;
        if (!post) return;
        const sentVersion = version, generation = selection;
        const sentDocument = structuredClone(document);
        const saved = await request('posts', { id: post.id, revision: post.revision, title: post.title, document: sentDocument });
        const next = { ...post, document: sentDocument, ...saved, hasUnpublishedChanges: post.state === 'published' || post.hasUnpublishedChanges };
        acknowledge(next, generation, sentVersion, true);
        return next;
    }
    return {
        get snapshot() { return snapshot; },
        get document() { return document; },
        get version() { return version; },
        setInventory(posts: Summary[]) { snapshot = { ...snapshot, posts }; },
        select(post: Post | null) {
            selection++; version++; document = post?.document ?? null;
            snapshot = { ...snapshot, post, dirty: false };
        },
        change(change: { document: unknown } | { title: string }) {
            if (!snapshot.post) return;
            version++;
            if ('document' in change) document = change.document;
            if ('title' in change) snapshot = { ...snapshot, post: { ...snapshot.post, title: change.title }, dirty: true };
            else if (!snapshot.dirty) snapshot = { ...snapshot, dirty: true };
        },
        // Preserve the latest editor document across a session-driven remount.
        retainDocument() { if (snapshot.post) snapshot = { ...snapshot, post: { ...snapshot.post, document } }; },
        save,
        async publish() {
            const post = snapshot.post;
            if (!post) return;
            const sentVersion = version, generation = selection;
            const saved = snapshot.dirty || !post.revision ? await save() : post;
            if (!saved) return;
            if (version !== sentVersion) throw new Error('The text changed while saving. Your draft is retained; publish again to include the latest changes.');
            let result;
            try { result = await request('publish', { id: saved.id, revision: saved.revision, action: 'publish' }); }
            catch (failure) { throw new Error(`Draft saved. Publishing could not be confirmed; check the live version before retrying. ${failure instanceof Error ? failure.message : ''}`); }
            acknowledge({ ...saved, ...result, hasUnpublishedChanges: false }, generation, sentVersion, false);
            return version === sentVersion ? 'Published. The live site now shows this version.' : 'Published the saved version. Your newer local edits are not published yet.';
        },
        async hide() {
            const post = snapshot.post;
            if (!post) return;
            const sentVersion = version, generation = selection;
            const result = await request('publish', { id: post.id, revision: post.revision, action: 'hide' });
            acknowledge({ ...post, ...result, hasUnpublishedChanges: false }, generation, sentVersion, false);
        },
    };
}
