import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = '.vercel/output';
const config = JSON.parse(await readFile(`${root}/config.json`, 'utf8'));
assert(config.routes.some((route) => route.handle === 'filesystem'), 'Static aliases need filesystem handling.');
for (const page of ['1', '12', '3']) {
    const alias = await readFile(`${root}/static/${page}.html`);
    const original = await readFile(`${root}/static/${page}/index.html`);
    assert.deepEqual(alias, original, `${page}.html must be an exact generated alias.`);
}
for (const path of ['/', '/index.html', '/admin', '/api/admin/posts', '/media/example-id', '/_image']) {
    assert(config.routes.some((route) => route.dest === '_render' && new RegExp(route.src).test(path)), `${path} must reach the server renderer.`);
}
console.log('Vercel output preserves legacy HTML aliases and dynamic routing.');
