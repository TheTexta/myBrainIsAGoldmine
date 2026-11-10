import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { localRequestsOnly } from '../support/browser';

test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', localRequestsOnly);
});

test('fits the main title on one line at every tested viewport', async ({ page }) => {
    await page.goto('/');
    for (const width of [320, 390, 660, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.locator('[data-fit-title]').evaluate((title) => Math.abs(title.getBoundingClientRect().width - title.closest('header')!.clientWidth))).toBeLessThan(2);
        await expect(page.locator('[data-fit-title]')).toHaveCSS('white-space', 'nowrap');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'U WANNA STEAL MY SWAG', exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: 'U WANNA STEAL MY SWAG', exact: true })).toHaveCSS('color', 'rgb(0, 0, 0)');
});

test('uses paper and charcoal multiply ink, zero post margins, and owner-selected padding', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('.content').first();
    await expect(panel).toHaveCSS('border-top-width', '0px');
    await expect(panel).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(panel).toHaveCSS('background-image', /white-recycle-paper-texture/);
    await expect(panel).toHaveCSS('color', 'rgb(24, 24, 24)');
    await expect(panel).toHaveCSS('padding-top', '0px');
    await expect(panel).toHaveCSS('padding-bottom', '0px');
    await expect(panel).toHaveCSS('padding-left', page.viewportSize()!.width <= 660 ? '4px' : '0px');
    for (const side of ['top', 'right', 'bottom', 'left']) await expect(panel).toHaveCSS(`margin-${side}`, '0px');
    const bounds = await panel.boundingBox();
    expect(bounds!.x + bounds!.width / 2).toBeCloseTo(page.viewportSize()!.width / 2, 0);
    const paragraph = panel.locator('p').first();
    await expect(paragraph).toHaveCSS('margin-top', '32px');
    await expect(paragraph).toHaveCSS('margin-left', '16px');
    await expect(paragraph).toHaveCSS('mix-blend-mode', 'multiply');
    await expect(panel.locator('h1').first()).toHaveCSS('margin-left', '16px');
    for (const media of await page.locator('.content > :is(p,figure):has(img,iframe)').all()) await expect(media).toHaveCSS('mix-blend-mode', 'normal');
    const selection = await paragraph.evaluate((element) => {
        const style = getComputedStyle(element, '::selection');
        return [style.color, style.backgroundColor];
    });
    expect(selection).toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)']);
    for (const image of await page.locator('.content img').all()) {
        const alt = await image.getAttribute('alt');
        expect(alt?.length).toBeGreaterThan(10);
        expect(alt).not.toMatch(/\b(?:image|photo|picture)\b/i);
    }
    for (const frame of await page.locator('iframe').all()) expect((await frame.getAttribute('title'))?.trim()).toBeTruthy();
});

test('separates every entry with a real sparkle-filled gap and scopes paper to posts', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
    const posts = page.locator('.feed-container > .content[data-post-id]');
    await expect(posts).toHaveCount(11);
    await expect(page.locator('.feed-container')).toHaveCSS('row-gap', '32px');
    await expect(page.locator('.feed-container')).toHaveCSS('padding-top', '32px');
    await expect(page.locator('.feed-container')).toHaveCSS('background-image', 'none');
    await expect(page.locator('body')).toHaveCSS('background-image', /glitter-still\.png/);
    expect(await page.locator('body').evaluate((element) => element.style.getPropertyValue('--post-paper'))).toBe('');
    const bounds = await posts.evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top + scrollY, bottom: rect.bottom + scrollY };
    }));
    const headerBottom = await page.locator('header').evaluate((element) => element.getBoundingClientRect().bottom + scrollY);
    expect(bounds[0].top - headerBottom).toBeCloseTo(32, 0);
    for (let index = 1; index < bounds.length; index++) expect(bounds[index].top - bounds[index - 1].bottom).toBeCloseTo(32, 0);
    for (const post of await posts.all()) {
        await expect(post.locator('h1')).toHaveCount(1);
        expect(await post.evaluate((element) => element.style.getPropertyValue('--post-paper'))).toContain('white-recycle-paper-texture');
    }
    const center = bounds[0].bottom + 16;
    await page.evaluate((top) => window.scrollTo(0, top - innerHeight / 2), center);
    expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('.content') === null)).toBe(true);
    const screenshot = await page.screenshot();
    const pixels = await sharp(screenshot).extract({ left: Math.floor(page.viewportSize()!.width / 2) - 32,
        top: Math.floor(page.viewportSize()!.height / 2) - 8, width: 64, height: 16 }).removeAlpha().raw().toBuffer();
    let sparkles = 0;
    for (let index = 0; index < pixels.length; index += 3) {
        if (pixels[index + 1] < 100 && pixels[index] > pixels[index + 1] * 1.2 && pixels[index + 2] > pixels[index + 1] * 1.2) sparkles++;
    }
    expect(sparkles).toBeGreaterThan(50);
});

test('enlarges the selected image with only an X close control and restores focus', async ({ page }, testInfo) => {
    await page.goto('/');
    const trigger = page.locator('a[data-post-image]').filter({ has: page.locator('img[data-original-src="img_3134.png"]') });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await trigger.evaluate((element: HTMLAnchorElement) => element.addEventListener('click', () => { element.dataset.openScroll = String(scrollY); }, { once: true }));
    if (testInfo.project.name === 'mobile') await trigger.tap(); else await trigger.press('Enter');
    const scrollPosition = Number(await trigger.getAttribute('data-open-scroll'));
    const viewer = page.getByRole('dialog', { name: 'Enlarged image' });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole('button')).toHaveCount(1);
    await expect(viewer.getByRole('button', { name: 'Close image', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(viewer.getByRole('button', { name: 'Close image', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(viewer.getByRole('button', { name: 'Close image', exact: true })).toBeFocused();
    await expect(viewer.locator('img')).toBeVisible();
    const imageBounds = await viewer.locator('img').evaluate(async (element: HTMLImageElement) => {
        await element.decode();
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const bounds = element.getBoundingClientRect();
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, naturalWidth: element.naturalWidth };
    });
    expect(imageBounds.naturalWidth).toBeGreaterThan(0);
    expect(imageBounds.width).toBeGreaterThan(0);
    expect(imageBounds.height).toBeGreaterThan(0);
    expect(imageBounds.x).toBeGreaterThanOrEqual(0);
    expect(imageBounds.y).toBeGreaterThanOrEqual(0);
    expect(imageBounds.x + imageBounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(imageBounds.y + imageBounds.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.screenshot({ path: `.impeccable/review/viewer-${testInfo.project.name}.png` });
    expect((await viewer.boundingBox())!.width).toBe(page.viewportSize()!.width);
    expect((await viewer.boundingBox())!.height).toBe(page.viewportSize()!.height);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await expect(viewer.locator('img')).toHaveAttribute('alt', /After we part/);
    await page.keyboard.press('Escape');
    await expect(viewer).not.toBeVisible();
    // Native dialog focus restoration precedes its queued close-event cleanup.
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(scrollPosition, 0);
    await page.getByRole('button', { name: 'Show Pinterest link' }).click();
    await expect(viewer).not.toBeVisible();
    await expect(page.locator('#cat')).toHaveCSS('cursor', 'pointer');
});

test('keeps the X close control available when an enlarged image fails', async ({ page }, testInfo) => {
    await page.goto('/');
    const trigger = page.locator('a[data-post-image]').first();
    await trigger.evaluate((element: HTMLAnchorElement) => { element.href = '/missing-viewer-test.jpg'; element.dataset.viewerSrcset = ''; });
    await trigger.click();
    const viewer = page.getByRole('dialog', { name: 'Enlarged image' });
    await expect(viewer.getByRole('status')).toContainText('could not be loaded');
    await expect(viewer.getByRole('button')).toHaveCount(1);
    await page.screenshot({ path: `.impeccable/review/viewer-error-${testInfo.project.name}.png` });
    await viewer.getByRole('button', { name: 'Close image', exact: true }).click();
    await expect(trigger).toBeFocused();
});
