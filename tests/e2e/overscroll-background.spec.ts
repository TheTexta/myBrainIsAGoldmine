import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { localRequestsOnly } from '../support/browser';

test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', localRequestsOnly);
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('keeps the exposed root canvas black without replacing page or post backgrounds', async ({ page }) => {
    for (const path of ['/', '/gallery']) {
        await page.goto(path);
        await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
        await expect(page.locator('html')).toHaveCSS('background-image', 'none');
        await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
        await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'dark');
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#000000');
        await expect(page.locator('body')).toHaveCSS('isolation', 'isolate');
        await expect(page.locator('body')).toHaveCSS('background-image', path === '/' ? /glitter-still\.png/ : /3\./);
        if (path === '/') {
            await expect(page.locator('.content').first()).toHaveCSS('background-image', /white-recycle-paper-texture/);
            await expect(page.locator('.content').first()).toHaveCSS('color', 'rgb(24, 24, 24)');
        }
        // Expose the underlying canvas directly. Headless engines cannot reproduce
        // an OS trackpad rubber-band gesture, so do not claim this is that gesture.
        await page.locator('body').evaluate((element: HTMLElement) => { element.style.display = 'none'; });
        const pixels = await sharp(await page.screenshot()).stats();
        expect(pixels.channels.slice(0, 3).map((channel) => channel.max)).toEqual([0, 0, 0]);
        if (pixels.channels[3]) expect(pixels.channels[3].min).toBe(255);
        await page.locator('body').evaluate((element: HTMLElement) => { element.style.removeProperty('display'); });
        await expect(page.locator('body')).toBeVisible();
    }
});

test('still paints negative-z floating photos above the opaque body background', async ({ page }) => {
    const green = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#00ff00' } }).png().toBuffer();
    await page.route((url) => url.href.includes('ab8f2798-749d-4c54-a3ba-a6488179292d'), (route) => route.fulfill({ contentType: 'image/png', body: green }));
    await page.goto('/?crt=off');
    const photo = page.locator('[data-floating-image]').first();
    await expect(photo).toBeVisible();
    await photo.locator('img').evaluate(async (element: HTMLImageElement) => { await element.decode(); });
    const bounds = await photo.boundingBox();
    const pixels = await sharp(await page.screenshot()).extract({ left: Math.floor(bounds!.x + bounds!.width / 2) - 4,
        top: Math.floor(bounds!.y + bounds!.height / 2) - 4, width: 8, height: 8 }).removeAlpha().raw().toBuffer();
    for (let index = 0; index < pixels.length; index += 3) {
        expect(pixels[index]).toBeLessThan(10); expect(pixels[index + 1]).toBeGreaterThan(240); expect(pixels[index + 2]).toBeLessThan(10);
    }
});

test('does not blend the fixed CRT into root canvas exposed above or below the document', async ({ page }, testInfo) => {
    await page.goto('/');
    const canvas = page.locator('[data-crt-overlay]');
    await expect(canvas).toHaveAttribute('data-crt', 'lottes');
    await expect(page.locator('body')).toHaveCSS('clip-path', /^inset\(/);
    await expect(page.locator('body')).toHaveCSS('transform', 'none');
    await expect(page.locator('body')).toHaveCSS('position', 'static');
    await page.evaluate(async () => {
        await document.fonts.ready;
        // A synthetic document gap, not an automated OS rubber-band gesture.
        // Green reveals any pale CRT pixels painted outside the isolated body.
        // Isolate painting from legacy feed overflow/mobile viewport scaling;
        // the other graphics cases retain the full page and its media/viewer.
        document.body.replaceChildren(document.querySelector('[data-crt-overlay]')!);
        document.documentElement.style.backgroundColor = '#00ff00';
        document.body.style.marginBlock = '96px';
        window.scrollTo(0, 0);
    });
    const assertRoot = async (top: number) => {
        const cropped = await sharp(await page.screenshot()).extract({ left: 32, top, width: 32, height: 32 }).png().toBuffer();
        const channels = (await sharp(cropped).stats()).channels.slice(0, 3);
        expect(channels.map((channel) => channel.min)).toEqual([0, 255, 0]);
        expect(channels.map((channel) => channel.max)).toEqual([0, 255, 0]);
        expect(await canvas.evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
    };
    await assertRoot(16);
    await page.screenshot({ path: `.impeccable/review/crt-root-gap-${testInfo.project.name}.png` });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.locator('body').evaluate((element) => element.getBoundingClientRect().bottom))
        .toBeLessThanOrEqual(page.viewportSize()!.height - 64);
    await assertRoot(page.viewportSize()!.height - 48);
});
