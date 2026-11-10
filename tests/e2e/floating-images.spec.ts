import { test, expect } from '@playwright/test';
import { localRequestsOnly } from '../support/browser';
import supplied from '../../src/assets/floating-images/provenance.json' with { type: 'json' };

test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', localRequestsOnly);
});

test('floats the supplied media across the document without entering posts', async ({ page }, testInfo) => {
    await page.clock.install();
    await page.goto('/');
    const layer = page.locator('[data-floating-images]');
    await expect(layer).toHaveAttribute('data-motion', 'moving');
    await expect(layer).toHaveAttribute('aria-hidden', 'true');
    await expect(layer).toHaveCSS('pointer-events', 'none');
    await expect(layer).toHaveCSS('position', 'absolute');
    await expect(layer.locator('[data-floating-image]')).toHaveCount(supplied.items.length);
    await expect(layer.locator('video')).toHaveCount(1);
    const images = layer.locator('img'); await expect(images).toHaveCount(15);
    await images.evaluateAll(async (elements: HTMLImageElement[]) => { await Promise.all(elements.map((image) => image.decode())); });
    for (const image of await images.all()) {
        await expect(image).toHaveAttribute('alt', '');
        const animated = await image.evaluate((element) => element.closest('[data-floating-image]')?.getAttribute('data-media-type') === 'gif');
        if (animated) await expect(image).toHaveAttribute('src', /floating-media\/img-0199\.gif/);
        else await expect(image).toHaveAttribute('srcset', /(?:\.webp|f=webp)/);
    }
    const before = await layer.locator('[data-floating-image]').first().getAttribute('style');
    await page.clock.runFor(2000);
    expect(await layer.locator('[data-floating-image]').first().getAttribute('style')).not.toBe(before);
    const checkGeometry = async () => {
        const geometry = await page.evaluate(() => {
            const world = (element: Element) => { const rect = element.getBoundingClientRect(); return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height }; };
            return { width: document.documentElement.clientWidth, height: document.body.offsetHeight, viewportHeight: innerHeight,
                photos: [...document.querySelectorAll('[data-floating-image]')].map(world), posts: [...document.querySelectorAll('.feed-container > .content')].map(world) };
        });
        expect(geometry.height).toBeGreaterThan(geometry.viewportHeight * 3);
        expect(Math.max(...geometry.photos.map((photo) => photo.y))).toBeGreaterThan(geometry.viewportHeight * 3);
        for (const photo of geometry.photos) {
            expect(photo.x).toBeGreaterThanOrEqual(0); expect(photo.y).toBeGreaterThanOrEqual(0);
            expect(photo.x + photo.width).toBeLessThanOrEqual(geometry.width + 0.1);
            expect(photo.y + photo.height).toBeLessThanOrEqual(geometry.height + 0.1);
            for (const post of geometry.posts) expect(photo.x < post.x + post.width + 5.9 && photo.x + photo.width > post.x - 5.9 && photo.y < post.y + post.height + 5.9 && photo.y + photo.height > post.y - 5.9).toBe(false);
        }
    };
    await checkGeometry();
    for (const width of [320, 390, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await page.clock.runFor(64);
        await checkGeometry();
    }
    await page.setViewportSize(testInfo.project.use.viewport!);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.runFor(64);
    await expect(layer).toHaveAttribute('data-motion', 'static');
    const worldBefore = await layer.locator('[data-floating-image]').first().evaluate((element) => element.getBoundingClientRect().top + scrollY);
    await page.evaluate(() => window.scrollTo(0, 1000));
    const bounds = await layer.locator('[data-floating-image]').first().boundingBox();
    expect(bounds!.y + 1000).toBeCloseTo(worldBefore, 0);
    expect(await page.locator('[data-crt-overlay]').evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `.impeccable/review/floating-${testInfo.project.name}.png` });
});

test('plays supplied animated media only while visible and permitted', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('[data-media-type="video"] video');
    await expect(video).toHaveAttribute('loop', '');
    expect(await video.evaluate((element: HTMLVideoElement) => element.muted && element.playsInline && element.paused && !element.controls)).toBe(true);
    await video.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - innerHeight / 2));
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
    expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
    const animation = page.locator('[data-media-type="gif"]');
    await animation.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - innerHeight / 2));
    await expect(animation.locator('source')).toHaveAttribute('media', '(prefers-reduced-motion: reduce)');
    await expect.poll(() => animation.locator('img').evaluate((element: HTMLImageElement) => element.currentSrc)).toMatch(/img-0199\.gif$/);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(animation.locator('source')).toHaveAttribute('media', 'all');
    await expect.poll(() => animation.locator('img').evaluate((element: HTMLImageElement) => element.currentSrc)).toMatch(/(?:\.webp|f=webp)/);
});

test('stops decorative motion for reduced motion, hidden tabs, dialogs, or insufficient space', async ({ page }) => {
    await page.clock.install(); await page.goto('/');
    const layer = page.locator('[data-floating-images]');
    await expect(layer).toHaveAttribute('data-motion', 'moving');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(layer).toHaveAttribute('data-motion', 'static');
    const still = await layer.locator('[data-floating-image]').first().getAttribute('style');
    await page.clock.runFor(1000);
    expect(await layer.locator('[data-floating-image]').first().getAttribute('style')).toBe(still);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(layer).toHaveAttribute('data-motion', 'moving');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(layer).toHaveAttribute('data-motion', 'paused');
    const paused = await layer.locator('[data-floating-image]').first().getAttribute('style');
    await page.clock.runFor(1000);
    expect(await layer.locator('[data-floating-image]').first().getAttribute('style')).toBe(paused);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(layer).toHaveAttribute('data-motion', 'moving');
    await page.locator('a[data-post-image]').first().click();
    await expect(layer).toHaveAttribute('data-motion', 'static');
    await page.getByRole('button', { name: 'Close image', exact: true }).click();
    await expect(layer).toHaveAttribute('data-motion', 'moving');
    await page.setViewportSize({ width: 680, height: 844 });
    await expect(layer).toHaveAttribute('data-motion', 'no-room'); await expect(layer).toBeHidden();
    await page.setViewportSize({ width: 1024, height: 844 });
    await expect(layer).toHaveAttribute('data-motion', 'moving');
});

test('updates full-document bounds after content grows and shrinks without height feedback', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
    const layer = page.locator('[data-floating-images]');
    await expect(layer).toHaveAttribute('data-motion', 'static');
    const original = await page.evaluate(() => document.body.offsetHeight);
    await page.locator('.content').first().evaluate((element: HTMLElement) => { element.style.minHeight = `${element.getBoundingClientRect().height + 800}px`; });
    await expect.poll(() => page.evaluate(() => document.body.offsetHeight)).toBeGreaterThanOrEqual(original + 799);
    await expect.poll(() => layer.evaluate((element) => element.getBoundingClientRect().height - document.body.offsetHeight)).toBe(0);
    const grown = await page.evaluate(() => document.body.offsetHeight);
    await page.locator('.content').first().evaluate((element: HTMLElement) => { element.style.minHeight = ''; });
    await expect.poll(() => page.evaluate(() => document.body.offsetHeight)).toBe(original);
    await expect.poll(() => layer.evaluate((element) => element.getBoundingClientRect().height)).toBe(original);
    expect(grown).toBeGreaterThan(original);
});
