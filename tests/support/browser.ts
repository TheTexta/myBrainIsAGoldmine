import type { Route } from '@playwright/test';
import { wordpressHost } from '../../src/lib/images/settings';

// Browser fixtures stay offline even when a local Astro image URL would cause
// the server to fetch WordPress. Real remote transformations are checked by the
// separate visual suite, not by these localhost-only protocol tests.
export function localRequestsOnly(route: Route) {
    const url = new URL(route.request().url());
    const source = url.searchParams.get('href');
    if (url.hostname !== '127.0.0.1' || (url.pathname === '/_image' && source?.startsWith(`https://${wordpressHost}/`))) return route.abort();
    return route.continue();
}
