import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { localRequestsOnly } from '../support/browser';

test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', localRequestsOnly);
});

test('serves responsive still images, keeps GIFs original, and downloads a smaller mirror', async ({ page, request }) => {
    await page.goto('/');
    const optimized = page.locator('.content img[data-original-src]');
    await expect(optimized).toHaveCount(20);
    for (const image of await optimized.all()) {
        await expect(image).toHaveAttribute('srcset', /\/_image\?.+ \d+w/);
        await expect(image).toHaveAttribute('sizes', /px/);
        await expect(image).toHaveAttribute('width', /^\d+$/);
        await expect(image).toHaveAttribute('height', /^\d+$/);
        await expect(image).toHaveAttribute('loading', 'lazy');
    }
    await expect(page.locator('#cat')).toHaveAttribute('src', 'Mal the Cat Normal.gif');
    await expect(page.locator('#cat')).not.toHaveAttribute('srcset');
    await page.goto('/1.html');
    const image = page.locator('img[data-original-src="mirror_base.png"]');
    await expect(image).toHaveAttribute('loading', 'eager');
    const dimensions = await image.evaluate(async (element: HTMLImageElement) => {
        await element.decode();
        return { currentSrc: element.currentSrc, displayWidth: element.getBoundingClientRect().width, density: devicePixelRatio };
    });
    const response = await request.get(dimensions.currentSrc);
    expect(response.status()).toBe(200);
    const bytes = await response.body(), metadata = await sharp(bytes).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBeLessThan(1440);
    expect(metadata.width!).toBeGreaterThanOrEqual(Math.floor(dimensions.displayWidth * dimensions.density));
    expect(bytes.length).toBeLessThan((await readFile('public/mirror_base.png')).length / 5);
});

test('loads a responsive cafe background instead of the 36MB original', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    const responsePromise = page.waitForResponse((response) => /\/_astro\/3\..+\.webp$/.test(new URL(response.url()).pathname));
    await page.goto('/3.html');
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeLessThan((await readFile('public/3.png')).length / 20);
    expect(requests).not.toContain('/3.png');
});

for (const animated of [false, true]) {
    test(`uses native Astro delivery for ${animated ? 'an original animated GIF' : 'a published R2 still'}, never for drafts`, async ({ page, request }) => {
        const signed = await request.post('http://127.0.0.1:54329/auth/v1/token', { data: { email: 'editor@local.test' } });
        const { access_token } = await signed.json();
        const headers = { Authorization: `Bearer ${access_token}`, Origin: 'http://127.0.0.1:4323' };
        const original = await readFile(animated ? 'public/Mal the Cat Normal.gif' : 'public/mirror_base.png');
        const reservationResponse = await request.post('/api/admin/media', { headers, data: { size: original.length, type: animated ? 'image/gif' : 'image/png' } });
        expect(reservationResponse.status()).toBe(200);
        const reservation = await reservationResponse.json();
        expect((await request.put(reservation.url, { data: original, headers: { 'Content-Type': animated ? 'image/gif' : 'image/png' } })).status()).toBe(200);
        const completion = await request.post(`/api/admin/media/${reservation.id}`, { headers, data: {} });
        expect(completion.status()).toBe(200);
        const media = await completion.json();
        const document = [{ type: 'image', props: { url: media.url, caption: 'Responsive upload' } }];
        const savedResponse = await request.post('/api/admin/posts', { headers, data: { id: randomUUID(), revision: 0, title: 'Native image delivery', document } });
        expect(savedResponse.status()).toBe(200);
        const saved = await savedResponse.json();
        expect((await request.get(media.url)).status()).toBe(404);
        const privateRead = await request.get(`/api/admin/media/${reservation.id}`, { headers });
        expect(privateRead.status()).toBe(200);
        const privateUrl = (await privateRead.json()).url;
        expect(new URL(privateUrl).searchParams.has('X-Amz-Signature')).toBe(true);
        expect(privateUrl).not.toContain('/_image');
        expect(await (await request.get(privateUrl)).body()).toEqual(original);
        const previewDocument = [{ type: 'paragraph', content: [{ type: 'text', text: 'Private content preview', styles: {} }] }, ...document];
        const preview = await request.post('/api/admin/preview', { headers, data: { document: previewDocument } });
        expect(preview.status()).toBe(200);
        const previewHtml = (await preview.json()).html;
        expect(previewHtml).not.toContain('/_image');
        expect(previewHtml).toContain('Private content preview');
        // Fixtures use HTTP R2, deliberately rejected by the HTTPS-only public
        // renderer. Actual HTTPS signed-image rendering is covered by unit tests;
        // real private-preview playback remains a production acceptance check.
        expect((await request.post('/api/admin/publish', { headers, data: { id: saved.id, revision: saved.revision, action: 'publish' } })).status()).toBe(200);
        await page.goto('/');
        const image = page.getByRole('img', { name: 'Responsive upload', exact: true });
        if (animated) {
            await expect(image).toHaveAttribute('src', media.url);
            await expect(image).not.toHaveAttribute('srcset');
        } else {
            await expect(image).toHaveAttribute('src', /\/_image\?href=http/);
            await expect(image).toHaveAttribute('srcset', /w=480/);
            const source = await image.evaluate(async (element: HTMLImageElement) => { await element.decode(); return element.currentSrc; });
            const derivative = await request.get(source);
            expect(derivative.status()).toBe(200);
            expect(derivative.headers()['content-type']).toBe('image/webp');
            expect(derivative.headers()['cache-control']).toContain('public');
            expect((await derivative.body()).length).toBeLessThan(original.length / 5);
        }
        expect(await (await request.get(media.url)).body()).toEqual(original);
        const publications = await (await request.get('/api/admin/posts', { headers })).json();
        const current = publications.find((post: { id: string }) => post.id === saved.id);
        expect((await request.post('/api/admin/publish', { headers, data: { id: saved.id, revision: current.revision, action: 'hide' } })).status()).toBe(200);
        expect((await request.get(media.url)).status()).toBe(404);
        // Native optimized copies may remain cached after unpublish by owner choice.
        expect(await (await request.get('/')).text()).not.toContain('Native image delivery');
    });
}
