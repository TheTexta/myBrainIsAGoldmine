// Publication and draft timestamps are equal immediately after publish. A later
// save changes only the draft timestamp. Preserve Postgres microsecond precision.
export function hasUnpublishedChanges(updatedAt: string | undefined, publication: { state: string; published_at: string | null } | null | undefined): boolean {
    if (publication?.state !== 'published' || !updatedAt || !publication.published_at) return false;
    const saved = Date.parse(updatedAt), published = Date.parse(publication.published_at);
    if (!Number.isFinite(saved) || !Number.isFinite(published)) return false;
    if (saved !== published) return saved > published;
    const remainder = (value: string) => (value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? '').padEnd(6, '0').slice(3, 6);
    return remainder(updatedAt) > remainder(publication.published_at);
}
