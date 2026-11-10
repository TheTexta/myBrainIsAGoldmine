import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { localRequestsOnly } from '../support/browser';

test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', localRequestsOnly);
});

test('scrolls sparkles at two-thirds speed while posts keep normal document scrolling', async ({ page }) => {
    // Freeze the GIF without enabling reduced motion, which deliberately opts out.
    const still = await readFile('public/crt/glitter-still.png');
    await page.route('**/glitter.gif', (route) => route.fulfill({ contentType: 'image/png', body: still }));
    await page.goto('/?crt=off');
    const panel = page.locator('.content').first();
    const top = (await panel.boundingBox())!.y;
    const region = { left: page.viewportSize()!.width - 32, top: 160, width: 16, height: 64 };
    const pixels = async () => sharp(await page.screenshot()).extract(region).removeAlpha().raw().toBuffer();
    const initial = await pixels();
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(page.locator('body')).toHaveCSS('background-position-y', '200px');
    expect((await panel.boundingBox())!.y).toBeCloseTo(top - 600, 0);
    // The 400px texture must repeat after 600px of document scroll, not 400px.
    expect((await pixels()).equals(initial)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 300));
    await expect(page.locator('body')).toHaveCSS('background-position-y', '100px');
    expect((await pixels()).equals(initial)).toBe(false);
});

test('updates reduced-motion preferences and resumes at the correct scroll offset', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(page.locator('body')).toHaveCSS('background-position-y', '200px');
    expect(await page.locator('[data-crt-overlay]').evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('body')).toHaveCSS('background-position-y', '0px');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('body')).toHaveCSS('background-position-y', '200px');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); window.scrollTo(0, 900); });
    await expect(page.locator('body')).toHaveCSS('background-position-y', '200px');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.locator('body')).toHaveCSS('background-position-y', '300px');
});

test('does not add parallax to artwork routes or the editor', async ({ page }) => {
    for (const path of ['/1.html', '/12.html', '/3.html', '/admin']) {
        await page.goto(path);
        expect(await page.locator('body').evaluate((element) => element.style.getPropertyValue('--glitter-scroll-offset'))).toBe('');
    }
});
