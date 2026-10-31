import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import legacy from '../fixtures/legacy.json' with { type: 'json' };

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});

for (const [path, baseline] of Object.entries(legacy.pages)) {
    test(`preserves original text, media, embeds, and links at ${path}`, async ({ page }) => {
        const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        const snapshot = await page.evaluate(() => ({
            title: document.title,
            text: [...document.querySelectorAll('header,h1,h2,p,li,button,a')].map((el) => [el.tagName, el.textContent!.replace(/\s+/g, ' ').trim()]),
            images: [...document.images].map((el) => [el.getAttribute('src'), el.getAttribute('alt'), el.id === 'mirror-screen' ? null : el.getAttribute('style'), el.getAttribute('class'), el.id]),
            embeds: [...document.querySelectorAll('iframe')].map((el) => [...el.attributes].map((a) => [a.name, a.value]).sort()),
            links: [...document.querySelectorAll('a')].map((el) => [el.getAttribute('href'), el.textContent!.replace(/\s+/g, ' ').trim()]),
            contentSections: document.querySelectorAll('.content').length,
        }));
        expect(snapshot.title).toBe(baseline.title); expect(snapshot.contentSections).toBe(baseline.contentSections);
        for (const key of ['text', 'images', 'embeds', 'links'] as const) expect(hash(snapshot[key]), `${key} differs from the original HTML`).toBe(baseline[`${key}Sha256`]);
        expect(errors).toEqual([]);
    });
}

test('preserves every original asset byte and does not publish PSD sources', async ({ request }) => {
    for (const [path, checksum] of Object.entries(legacy.assets)) {
        const bytes = await readFile(path.endsWith('.psd') ? path : `dist/client/${path}`);
        expect(createHash('sha256').update(bytes).digest('hex'), path).toBe(checksum);
        if (path.endsWith('.psd')) expect((await request.get(`/${encodeURIComponent(path)}`)).status()).toBe(404);
    }
    for (const path of ['/', '/index.html', '/1.html', '/12.html', '/3.html', '/style.css', '/mal%20the%20cat.gif', '/assets/favicon/site.webmanifest']) expect((await request.get(path)).status(), path).toBe(200);
});

test('keeps editor bundles off the homepage and retains cat/navigation behavior', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => { if (request.resourceType() === 'script') scripts.push(request.url()); });
    await page.goto('/');
    expect(await page.locator('astro-island').count()).toBe(0);
    expect(scripts.some((url) => /AdminApp|DocumentEditor|BlockNote/i.test(url))).toBe(false);
    await expect(page.locator('#cat-button')).toBeHidden();
    await page.locator('#cat').click();
    await expect(page.locator('#cat')).toHaveAttribute('src', 'mal the cat.gif');
    await expect(page.locator('#cat-button')).toBeVisible();
    await page.locator('#cat').click();
    await expect(page.locator('#cat-button')).toBeHidden();
    await page.getByRole('button', { name: 'U WANNA STEAL MY SWAG' }).click();
    await expect(page).toHaveURL(/\/12.html$/);
    await page.locator('.back-button').hover();
    await expect(page.locator('.fun-container img')).toHaveAttribute('src', '12-1.png');
    await page.mouse.move(0, 0);
    await expect(page.locator('.fun-container img')).toHaveAttribute('src', '12-2.png');
    await page.locator('.back-button').click();
    await expect(page).toHaveURL(/\/index.html$/);
});

test('retains the mirror animation', async ({ page }) => {
    await page.clock.install(); await page.goto('/1.html');
    await page.clock.pauseAt(new Date(Date.now() + 100));
    const frames = new Set<string | null>();
    for (let frame = 0; frame < 6; frame++) { await page.clock.runFor(10); frames.add(await page.locator('#mirror-screen').getAttribute('style')); }
    expect(frames.size).toBeGreaterThan(1);
});

test('does not resurrect original content during a configured database outage', async ({ request }) => {
    await request.post('http://127.0.0.1:54329/__outage', { data: { enabled: true } });
    const response = await request.get('/'); expect(response.status()).toBe(503);
    expect(await response.text()).not.toContain('Protected: my brain is a goldmine.');
});
