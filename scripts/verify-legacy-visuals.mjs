import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

// Verify the unconfigured feed against reviewed Tailwind screenshots, while also
// retaining comparisons with the immutable original revision. No live CMS writes.
const root = process.cwd();
const fixture = JSON.parse(await readFile('tests/fixtures/legacy.json', 'utf8'));
const updateBaseline = process.argv.includes('--update-baseline');
const baselineDirectory = path.join(root, 'tests/fixtures/tailwind-visuals');
if (updateBaseline) await mkdir(baselineDirectory, { recursive: true });
const pixels = (image) => sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
function changedPixels(before, after) {
    if (before.info.width !== after.info.width || before.info.height !== after.info.height) return -1;
    let changed = 0;
    for (let offset = 0; offset < before.data.length; offset += 4) {
        if (!before.data.subarray(offset, offset + 4).equals(after.data.subarray(offset, offset + 4))) changed++;
    }
    return changed;
}
const tempRoot = path.join(tmpdir(), 'opencode');
await mkdir(tempRoot, { recursive: true });
const scratch = await mkdtemp(path.join(tempRoot, 'mybrain-visual-'));
const original = path.join(scratch, 'original');
await mkdir(original);
execFileSync('git', ['archive', fixture.sourceRevision, '--output', path.join(scratch, 'original.tar')]);
execFileSync('tar', ['-xf', path.join(scratch, 'original.tar'), '-C', original]);
const servers = [
    spawn('python3', ['-m', 'http.server', '4326', '--bind', '127.0.0.1', '--directory', original], { stdio: 'ignore' }),
    spawn(process.execPath, ['dist/server/entry.mjs'], { stdio: 'ignore', env: { ...process.env, HOST: '127.0.0.1', PORT: '4325', PUBLIC_SUPABASE_URL: '', PUBLIC_SUPABASE_ANON_KEY: '' } }),
];
let browser;
const cache = new Map();
const remoteFailures = new Set();
const results = [];
try {
    for (const port of [4326, 4325]) {
        let ready = false;
        for (let attempt = 0; attempt < 100; attempt++) {
            try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) { ready = true; break; } } catch { /* Starting. */ }
            await setTimeout(100);
        }
        if (!ready) throw new Error(`Local visual baseline server ${port} did not start.`);
    }
    browser = await chromium.launch();
    for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
        for (const route of Object.keys(fixture.pages)) {
            const captures = [];
            let snapshotChangedPixels = 0;
            for (const [label, port] of [['original', 4326], ['astro', 4325]]) {
                const page = await browser.newPage({ viewport });
                // Keep the overlay active while making background motion reproducible.
                if (label === 'astro' && route === '/index.html') await page.emulateMedia({ reducedMotion: 'reduce' });
                if (route === '/1.html') {
                    await page.clock.install({ time: new Date('2026-10-30T12:00:00Z') });
                    await page.clock.pauseAt(new Date('2026-10-30T12:00:01Z'));
                }
                await page.route('**/*', async (request) => {
                    const url = new URL(request.request().url());
                    if (url.hostname === '127.0.0.1') {
                        if (!url.pathname.toLowerCase().endsWith('.gif')) return request.continue();
                        const key = url.pathname;
                        if (!cache.has(key)) cache.set(key, sharp(await readFile(path.join(root, 'public', decodeURIComponent(key)))).png().toBuffer());
                        return request.fulfill({ contentType: 'image/png', body: await cache.get(key) });
                    }
                    if (request.request().resourceType() === 'document' || url.hostname === 'videopress.com') return request.fulfill({ contentType: request.request().resourceType() === 'script' ? 'text/javascript' : 'text/html', body: '' });
                    if (!cache.has(url.href)) cache.set(url.href, (async () => {
                        try {
                            const response = await request.fetch({ timeout: 15000 });
                            if (!response.ok()) throw new Error('Remote asset failed.');
                            return { body: await response.body(), contentType: response.headers()['content-type'] };
                        } catch { remoteFailures.add(url.href); return null; }
                    })());
                    const response = await cache.get(url.href);
                    return response ? request.fulfill(response) : request.abort();
                });
                const response = await page.goto(`http://127.0.0.1:${port}${route}`);
                if (response.status() !== 200) throw new Error(`Cannot compare ${route}: HTTP ${response.status()}`);
                if (label === 'astro' && route === '/index.html') await page.waitForSelector('[data-crt="lottes"]');
                await page.evaluate(async () => {
                    await document.fonts.ready;
                    // Exercise every below-fold image in full-page snapshots,
                    // without disabling native lazy loading in the actual site.
                    document.querySelectorAll('img').forEach((image) => { image.loading = 'eager'; });
                    await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
                    const backgrounds = new Set([...document.querySelectorAll('*')].flatMap((element) =>
                        [...getComputedStyle(element).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((match) => match[1])));
                    document.querySelectorAll('video[poster]').forEach((video) => { video.pause(); backgrounds.add(video.poster); });
                    await Promise.all([...backgrounds].map(async (url) => { const image = new Image(); image.src = url; await image.decode(); }));
                    document.querySelectorAll('iframe').forEach((frame) => { frame.removeAttribute('src'); frame.srcdoc = ''; });
                });
                const failed = await page.evaluate(() => [...document.images].filter((image) => !image.complete || !image.naturalWidth).map((image) => image.currentSrc || image.src));
                failed.forEach((source) => remoteFailures.add(source));
                if (route === '/1.html') await page.clock.runFor(50);
                else await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                const capture = await page.screenshot({ fullPage: true, animations: 'disabled' });
                const basename = `${label}-${route.slice(1, -5)}-${name}`;
                await writeFile(path.join(scratch, `${basename}.png`), capture);
                if (label === 'astro') {
                    await mkdir('.impeccable/review', { recursive: true });
                    await page.screenshot({ path: `.impeccable/review/public-${route.slice(1, -5)}-${name}.png`, animations: 'disabled' });
                    const baselinePath = path.join(baselineDirectory, `${route.slice(1, -5)}-${name}.png`);
                    if (updateBaseline) await writeFile(baselinePath, capture);
                    snapshotChangedPixels = changedPixels(await pixels(await readFile(baselinePath)), await pixels(capture));
                }
                captures.push(await pixels(capture));
                await page.close();
            }
            const [before, after] = captures;
            results.push({ route, viewport: name, width: after.info.width, height: after.info.height,
                legacyChangedPixels: changedPixels(before, after), snapshotChangedPixels });
        }
    }
    await writeFile(path.join(scratch, 'report.json'), JSON.stringify({ results, remoteFailures: [...remoteFailures] }, null, 2));
    console.log(JSON.stringify({ results, remoteFailures: [...remoteFailures], artifacts: scratch }, null, 2));
    if (remoteFailures.size || results.some((result) => result.snapshotChangedPixels !== 0)) process.exitCode = 1;
} finally {
    await browser?.close();
    for (const server of servers) server.kill('SIGTERM');
}
