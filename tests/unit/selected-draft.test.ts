import { describe, expect, it, vi } from 'vitest';
import { createSelectedDraft, type Post } from '../../src/lib/selected-draft';

const entry = (id = 'one'): Post => ({ id, title: 'Original', revision: 1, legacy_key: null, state: 'draft', document: [{ type: 'paragraph' }], legacyHtml: null });
function deferred() {
    let resolve!: (value: Partial<Post>) => void, reject!: (reason: Error) => void;
    const promise = new Promise<Partial<Post>>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

describe('selected draft workflow', () => {
    it('saves a snapshot privately and acknowledges its revision in selection and inventory', async () => {
        const request = vi.fn().mockResolvedValue({ revision: 2 });
        const draft = createSelectedDraft(request);
        draft.select({ ...entry(), state: 'published' });
        const document = [{ type: 'paragraph', text: 'New' }];
        draft.change({ document }); draft.change({ title: 'New title' });
        await draft.save();
        expect(request).toHaveBeenCalledExactlyOnceWith('posts', { id: 'one', revision: 1, title: 'New title', document });
        expect(request.mock.calls[0][1].document).not.toBe(document);
        expect(draft.snapshot).toMatchObject({ dirty: false, post: { revision: 2, hasUnpublishedChanges: true }, posts: [{ revision: 2, title: 'New title' }] });
    });
    it('preserves edits made during save, but advances the saved revision', async () => {
        const pending = deferred();
        const draft = createSelectedDraft(() => pending.promise);
        draft.select(entry()); draft.change({ title: 'Sent' });
        const saving = draft.save();
        const newer = [{ type: 'paragraph', text: 'Newer' }];
        draft.change({ title: 'Newer' }); draft.change({ document: newer });
        pending.resolve({ revision: 2, title: 'Sent' }); await saving;
        expect(draft.snapshot).toMatchObject({ dirty: true, post: { title: 'Newer', revision: 2, document: entry().document }, posts: [{ title: 'Sent', revision: 2 }] });
        expect(draft.document).toBe(newer);
    });
    it('stops publication if edits or selection change while saving', async () => {
        for (const change of ['edit', 'selection']) {
            const pending = deferred();
            const request = vi.fn(() => pending.promise);
            const draft = createSelectedDraft(request);
            draft.select(entry()); draft.change({ title: 'Sent' });
            const publishing = draft.publish();
            if (change === 'edit') draft.change({ title: 'Newer' });
            else draft.select(entry('two'));
            pending.resolve({ revision: 2 });
            await expect(publishing).rejects.toThrow('text changed while saving');
            expect(request).toHaveBeenCalledTimes(1);
            expect(draft.snapshot.post?.id).toBe(change === 'edit' ? 'one' : 'two');
        }
    });
    it('publishes the acknowledged save, retaining newer local edits during publication', async () => {
        const pending = deferred();
        const request = vi.fn().mockResolvedValueOnce({ revision: 2 }).mockReturnValueOnce(pending.promise);
        const draft = createSelectedDraft(request);
        draft.select(entry()); draft.change({ title: 'Sent' });
        const publishing = draft.publish();
        await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
        draft.change({ title: 'Newer' }); draft.change({ document: ['local'] });
        pending.resolve({ state: 'published', revision: 3 });
        expect(await publishing).toContain('newer local edits');
        expect(request.mock.calls[1]).toEqual(['publish', { id: 'one', revision: 2, action: 'publish' }]);
        expect(draft.snapshot).toMatchObject({ dirty: true, post: { title: 'Newer', state: 'published', revision: 3 }, posts: [{ title: 'Sent', revision: 3, hasUnpublishedChanges: false }] });
        expect(draft.document).toEqual(['local']);
        request.mockResolvedValueOnce({ revision: 4 }); await draft.save();
        expect(request.mock.calls[2]).toEqual(['posts', { id: 'one', revision: 3, title: 'Newer', document: ['local'] }]);
        expect(draft.snapshot).toMatchObject({ dirty: false, post: { revision: 4, hasUnpublishedChanges: true } });
    });
    it('does not overwrite another selection, even after leaving and returning to the same ID', async () => {
        for (const sameId of [false, true]) {
            const pending = deferred();
            const draft = createSelectedDraft(() => pending.promise);
            draft.select(entry());
            const publishing = draft.publish();
            draft.select(entry('two'));
            if (sameId) { draft.select(entry()); draft.change({ title: 'Reopened' }); }
            pending.resolve({ revision: 2, state: 'published' }); await publishing;
            expect(draft.snapshot.post).toMatchObject({ id: sameId ? 'one' : 'two', title: sameId ? 'Reopened' : 'Original', revision: 1, state: 'draft' });
            expect(draft.snapshot.posts[0]).toMatchObject({ id: 'one', revision: 2, state: 'published' });
        }
    });
    it('retains unsaved text and revision on a stale save failure', async () => {
        const request = vi.fn().mockRejectedValue(new Error('Revision conflict'));
        const draft = createSelectedDraft(request);
        draft.select(entry()); draft.change({ document: ['keep'] });
        await expect(draft.publish()).rejects.toThrow('Revision conflict');
        expect(draft.snapshot).toMatchObject({ dirty: true, post: { revision: 1 }, posts: [] });
        expect(draft.document).toEqual(['keep']);
        expect(request).toHaveBeenCalledTimes(1);
    });
    it('retains a confirmed save on uncertain publish and retries only the acknowledged revision', async () => {
        const request = vi.fn().mockResolvedValueOnce({ revision: 2 }).mockRejectedValueOnce(new Error('Network lost')).mockResolvedValueOnce({ state: 'published', revision: 3 });
        const draft = createSelectedDraft(request);
        draft.select(entry()); draft.change({ document: ['saved'] });
        await expect(draft.publish()).rejects.toThrow('Publishing could not be confirmed');
        expect(draft.snapshot).toMatchObject({ dirty: false, post: { revision: 2, state: 'draft' }, posts: [{ revision: 2 }] });
        expect(await draft.publish()).toBe('Published. The live site now shows this version.');
        expect(request.mock.calls.map(([path]) => path)).toEqual(['posts', 'publish', 'publish']);
        expect(request.mock.calls[2][1]).toEqual({ id: 'one', revision: 2, action: 'publish' });
    });
    it('unpublishes only the acknowledged selection and retains newer local changes', async () => {
        const pending = deferred();
        const draft = createSelectedDraft(() => pending.promise);
        draft.select({ ...entry(), state: 'published' });
        const hiding = draft.hide(); draft.change({ title: 'Newer' });
        pending.resolve({ state: 'hidden', revision: 2 }); await hiding;
        expect(draft.snapshot).toMatchObject({ dirty: true, post: { title: 'Newer', state: 'hidden', revision: 2 }, posts: [{ title: 'Original', state: 'hidden', revision: 2 }] });
    });
    it('keeps the saved draft when an uncertain publish retry conflicts with the server', async () => {
        const request = vi.fn().mockResolvedValueOnce({ revision: 2 }).mockRejectedValueOnce(new Error('Network lost')).mockRejectedValueOnce(new Error('Revision conflict'));
        const draft = createSelectedDraft(request);
        draft.select(entry()); draft.change({ document: ['keep'] });
        await expect(draft.publish()).rejects.toThrow('could not be confirmed');
        await expect(draft.publish()).rejects.toThrow('Revision conflict');
        expect(draft.snapshot).toMatchObject({ dirty: false, post: { revision: 2, state: 'draft', document: ['keep'] } });
        expect(draft.document).toEqual(['keep']);
        expect(request.mock.calls.map(([path]) => path)).toEqual(['posts', 'publish', 'publish']);
    });
    it('retains the document across session remount without invalidating clean status', () => {
        const draft = createSelectedDraft(vi.fn());
        draft.select(entry()); draft.change({ document: ['local'] }); draft.retainDocument();
        expect(draft.snapshot.post?.document).toEqual(['local']);
        expect(draft.snapshot.dirty).toBe(true);
        const snapshot = draft.snapshot;
        draft.change({ document: ['newer'] });
        expect(draft.snapshot).toBe(snapshot);
        draft.select(null);
        expect(draft.document).toBeNull();
    });
});
