import { test, expect, type Page } from '@playwright/test';
import { localRequestsOnly } from '../support/browser';

test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', localRequestsOnly);
});

async function assertInViewport(page: Page) {
    const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
        photos: [...document.querySelectorAll('[data-floating-image]')].map((element) => {
            const bounds = element.getBoundingClientRect();
            return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
        }) }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height + 1);
    expect(geometry.photos).toHaveLength(16);
    for (const photo of geometry.photos) {
        expect(photo.x).toBeGreaterThanOrEqual(-0.1); expect(photo.y).toBeGreaterThanOrEqual(-0.1);
        expect(photo.x + photo.width).toBeLessThanOrEqual(geometry.width + 0.1);
        expect(photo.y + photo.height).toBeLessThanOrEqual(geometry.height + 0.1);
    }
    return geometry;
}

test('spawns every supplied item centrally over the optimized 3.png background', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/gallery');
    const layer = page.locator('[data-floating-images]');
    await expect(layer).toHaveAttribute('data-motion', 'static');
    await expect(layer).not.toHaveAttribute('inert');
    const buttons = layer.getByRole('button'); await expect(buttons).toHaveCount(16);
    const geometry = await assertInViewport(page);
    for (const photo of geometry.photos) {
        expect(photo.x + photo.width / 2).toBeCloseTo(geometry.width / 2, 0);
        expect(photo.y + photo.height / 2).toBeCloseTo(geometry.height / 2, 0);
    }
    for (const button of await buttons.all()) expect((await button.getAttribute('aria-label'))!.length).toBeGreaterThan(15);
    await expect(page.locator('body')).toHaveCSS('background-image', /3\./);
    await expect(page.locator('body')).toHaveCSS('background-size', 'cover');
    const back = page.getByRole('link', { name: 'Back to posts', exact: true });
    await expect(back).toHaveCSS('border-top-width', '0px');
    await expect(back).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(back).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(back).toHaveCSS('text-decoration-line', 'none');
    await back.hover(); await expect(back).toHaveCSS('color', 'rgb(0, 0, 0)');
    await page.mouse.move(0, 0);
    await back.focus(); await expect(back).toHaveCSS('outline-style', 'none');
    await expect(back).toHaveCSS('text-decoration-line', 'none');
    await page.screenshot({ path: `.impeccable/review/gallery-centre-${testInfo.project.name}.png` });
});

test('expands one photo at a time, keeps movement, and stays in bounds after resize', async ({ page }, testInfo) => {
    await page.clock.install(); await page.goto('/gallery');
    const layer = page.locator('[data-floating-images]'); await expect(layer).toHaveAttribute('data-motion', 'moving');
    const photo = layer.getByRole('button').last(), other = layer.getByRole('button').first();
    const original = await photo.boundingBox();
    // Native click, without waiting for a deliberately moving button to be stable.
    const point = await photo.boundingBox(); await page.mouse.click(point!.x + point!.width / 2, point!.y + point!.height / 2);
    await expect(photo).toHaveAttribute('aria-expanded', 'true');
    expect((await photo.boundingBox())!.width).toBeGreaterThan(original!.width);
    await expect(layer.locator('[aria-expanded="true"]')).toHaveCount(1);
    const before = await photo.getAttribute('style'); await page.clock.runFor(750);
    expect(await photo.getAttribute('style')).not.toBe(before);
    await assertInViewport(page);
    await other.focus(); await page.keyboard.press('Enter');
    await expect(other).toHaveAttribute('aria-expanded', 'true');
    await expect(photo).toHaveAttribute('aria-expanded', 'false');
    await expect(layer.locator('[aria-expanded="true"]')).toHaveCount(1);
    for (const [width, height] of [[320, 568], [844, 390], [1440, 900]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await page.clock.runFor(64);
        await assertInViewport(page);
    }
    await page.keyboard.press('Escape'); await expect(layer.locator('[aria-expanded="true"]')).toHaveCount(0);
    await page.clock.runFor(3000); await assertInViewport(page);
    await page.setViewportSize(testInfo.project.use.viewport!);
    await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await page.clock.runFor(64);
    await page.screenshot({ path: `.impeccable/review/gallery-moving-${testInfo.project.name}.png` });
});

test('background and floating-media clicks navigate without hijacking posts or controls', async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
    await page.locator('.content').first().click({ position: { x: 30, y: 80 } });
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('button', { name: 'Show Pinterest link', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Hide Pinterest link', exact: true })).toBeVisible();
    await page.mouse.click(testInfo.project.use.viewport!.width - 16, 200);
    await expect(page).toHaveURL(/\/gallery\/?$/);
    await page.getByRole('link', { name: 'Back to posts', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    const picture = await page.locator('[data-floating-image]').first().boundingBox();
    await page.mouse.click(picture!.x + picture!.width / 2, picture!.y + picture!.height / 2);
    await expect(page).toHaveURL(/\/gallery\/?$/);
    await page.goto('/');
    await page.getByRole('link', { name: 'Gallery', exact: true }).focus();
    await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/gallery\/?$/);
});

test('reduced motion freezes the gallery while retaining expansion and the 3.png background', async ({ page }) => {
    await page.clock.install(); await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/gallery');
    const layer = page.locator('[data-floating-images]'); await expect(layer).toHaveAttribute('data-motion', 'static');
    const photo = layer.getByRole('button').last();
    const before = await photo.getAttribute('style'); await page.clock.runFor(1000);
    expect(await photo.getAttribute('style')).toBe(before);
    await photo.focus(); await page.keyboard.press('Enter'); await expect(photo).toHaveAttribute('aria-expanded', 'true');
    await assertInViewport(page);
    await page.keyboard.press('Enter'); await expect(photo).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('video')).toHaveJSProperty('paused', true);
    await expect(page.locator('[data-animated-still]')).toHaveAttribute('media', 'all');
    await expect(page.locator('body')).toHaveCSS('background-image', /3\./);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(layer).toHaveAttribute('data-motion', 'moving'); await page.clock.runFor(1000);
    expect(await photo.getAttribute('style')).not.toBe(before);
    await assertInViewport(page);
});
