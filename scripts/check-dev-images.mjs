import assert from 'node:assert/strict';
import { dev } from 'astro';
import { parse } from 'parse5';

// An isolated ephemeral-port server: no reuse/stop of a user's dev server, no
// browser image fetches, and no configured CMS reads. Tests the DEV-only audit
// contract that production-build browser tests cannot exercise.
const server = await dev({ root: new URL('../', import.meta.url), logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, open: false } });
try {
    const response = await fetch(`http://127.0.0.1:${server.address.port}/`);
    assert.equal(response.status, 200);
    const optimized = [];
    function visit(node) {
        if (node.tagName === 'img') {
            const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]));
            if (attributes.get('src')?.startsWith('/_image?')) optimized.push(attributes);
        }
        node.childNodes?.forEach(visit);
    }
    visit(parse(await response.text()));
    assert.equal(optimized.length, 20, 'All existing public post stills must be optimized.');
    for (const attributes of optimized) {
        assert.equal(attributes.get('data-image-component'), 'true', `${attributes.get('data-original-src')} must be recognized by Astro's audit.`);
        assert(attributes.get('srcset')?.includes('/_image?'), 'The marker must accompany actual optimized sources.');
    }
    console.log('All 20 optimized post images are recognized by the development image-component audit.');
} finally {
    await server.stop();
}
