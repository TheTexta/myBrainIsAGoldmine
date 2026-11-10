import { test, expect } from '@playwright/test';
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

test('uses inverted selection, borderless posts, and half panel padding on mobile', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('.content').first();
    await expect(panel).toHaveCSS('border-top-width', '0px');
    await expect(panel).toHaveCSS('padding-top', page.viewportSize()!.width <= 660 ? '8px' : '16px');
    const paragraph = panel.locator('p').first();
    await expect(paragraph).toHaveCSS('margin-top', '32px');
    const selection = await paragraph.evaluate((element) => {
        const style = getComputedStyle(element, '::selection');
        return [style.color, style.backgroundColor];
    });
    expect(selection).toEqual(['rgb(0, 0, 0)', 'rgb(255, 255, 255)']);
    for (const image of await page.locator('.content img').all()) {
        const alt = await image.getAttribute('alt');
        expect(alt?.length).toBeGreaterThan(10);
        expect(alt).not.toMatch(/\b(?:image|photo|picture)\b/i);
    }
    for (const frame of await page.locator('iframe').all()) expect((await frame.getAttribute('title'))?.trim()).toBeTruthy();
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
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(scrollPosition, 0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
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
