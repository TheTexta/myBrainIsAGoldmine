import { legacyEntries, type LegacyEntry } from '../content/legacy';
import { renderDocument } from './documents';
import { allRows, HttpError, publicConfig, supabase } from './server';

interface Publication {
    id: string; legacy_key: string | null; group_index: number | null; position: number;
    state: 'legacy' | 'published' | 'hidden'; title: string | null; document: unknown;
}
export interface FeedEntry { id: string; title: string; html: string; legacy: boolean; }

export function assembleFeed(publications: Publication[] = []): FeedEntry[][] {
    const byId = new Map(publications.map((post) => [post.id, post]));
    const entries: { entry: FeedEntry; group: string; position: number }[] = [];
    const add = (post: Publication | undefined, original?: LegacyEntry) => {
        if (post?.state === 'hidden') return;
        if (post?.state === 'published') {
            entries.push({ entry: { id: post.id, title: post.title!, html: renderDocument(post.document), legacy: false },
                group: original ? `legacy-${original.group}` : post.id, position: original?.position ?? post.position });
        } else if (original) {
            entries.push({ entry: { id: original.id, title: original.title, html: original.html, legacy: true },
                group: `legacy-${original.group}`, position: original.position });
        }
    };
    for (const original of legacyEntries) add(byId.get(original.id), original);
    for (const post of publications) if (!post.legacy_key) add(post);
    entries.sort((a, b) => a.position - b.position || a.entry.id.localeCompare(b.entry.id));
    const groups = new Map<string, FeedEntry[]>();
    for (const { group, entry } of entries) {
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group)!.push(entry);
    }
    return [...groups.values()];
}

export async function loadFeed(): Promise<FeedEntry[][]> {
    if (!publicConfig()) return assembleFeed();
    const data = await allRows<Publication>(supabase(), 'mybrain_publications', '*', ['position', 'id']);
    if (!legacyEntries.every((entry) => data.some((row) => row.id === entry.id && row.legacy_key === entry.key))) {
        throw new HttpError(503, 'The publication inventory is incomplete.');
    }
    // When configured, errors must not resurrect unpublished original content.
    return assembleFeed(data);
}
