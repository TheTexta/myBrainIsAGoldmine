import { test, expect, type Locator } from '@playwright/test';
import sharp from 'sharp';
import { localRequestsOnly } from '../support/browser';

test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', localRequestsOnly);
    await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function colors(control: Locator, inverted = false) {
    await expect(control).toHaveCSS('background-color', inverted ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)');
    await expect(control).toHaveCSS('color', inverted ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)');
    await expect(control).toHaveCSS('background-image', 'none');
}

test('loads the local font and paints inverted gallery controls for hover and keyboard focus', async ({ page, browserName }, testInfo) => {
    const fontResponse = page.waitForResponse((response) => new URL(response.url()).pathname === '/fonts/tdatext/TDAText.ttf');
    await page.goto('/gallery?crt=off');
    expect((await fontResponse).ok()).toBe(true);
    const fonts = await page.evaluate(async () => {
        const faces = await document.fonts.load('20px TDAText', 'Back to posts');
        return faces.map((face) => ({ family: face.family, status: face.status }));
    });
    expect(fonts).toEqual([{ family: 'TDAText', status: 'loaded' }]);
    const back = page.getByRole('link', { name: 'Back to posts', exact: true });
    await expect(back).toHaveCSS('font-family', /TDAText/);
    await expect(back).toHaveCSS('font-size', '20px');
    await expect(back).toHaveCSS('border-radius', '0px');
    await expect(back).toHaveCSS('border-top-width', '0px');
    await expect(back).toHaveCSS('transition-duration', '0s');
    await colors(back);
    const patch = async () => {
        const cropped = await sharp(await back.screenshot()).extract({ left: 4, top: 4, width: 4, height: 4 }).png().toBuffer();
        return (await sharp(cropped).stats()).channels.slice(0, 3);
    };
    expect((await patch()).map((channel) => channel.max)).toEqual([0, 0, 0]);
    await page.screenshot({ path: `.impeccable/review/crt-controls-gallery-${testInfo.project.name}.png` });
    await back.hover(); await colors(back, true);
    expect((await patch()).map((channel) => channel.min)).toEqual([255, 255, 255]);
    await page.mouse.move(0, 0); await colors(back);
    // WebKit's platform default uses Option+Tab to include links in traversal.
    await page.locator('.floating-gallery button').last().focus();
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expect(back).toBeFocused(); await colors(back, true);
    await page.keyboard.press('Enter'); await expect(page).toHaveURL(/\/$/);
});

test('uses TDAText on the header while preserving footer, writing, artwork and media buttons', async ({ page }, testInfo) => {
    await page.goto('/?crt=off');
    await expect(page.locator('.content').first()).toHaveCSS('font-family', /Tinos/);
    await expect(page.locator('.content').first()).toHaveCSS('background-image', /white-recycle-paper-texture/);
    await expect(page.locator('.header-title')).toHaveCSS('font-family', /TDAText/);
    await expect(page.locator('.header-title')).toHaveCSS('white-space', 'nowrap');
    const header = page.locator('.site-header-action');
    await page.mouse.move(0, 400); await colors(header);
    await header.hover(); await colors(header, true);
    await page.mouse.move(0, 400);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `.impeccable/review/crt-controls-header-${testInfo.project.name}.png` });
    await expect(page.locator('.site-header-action')).not.toHaveClass(/crt-control/);
    await expect(page.locator('.cat-toggle')).not.toHaveClass(/crt-control/);
    await expect(page.locator('.post-image-link').first()).not.toHaveClass(/crt-control/);
    const footer = page.locator('footer');
    for (const width of [320, testInfo.project.use.viewport!.width]) {
        await page.setViewportSize({ width, height: testInfo.project.use.viewport!.height });
        await footer.scrollIntoViewIfNeeded();
        for (const control of await footer.getByRole('link').all()) {
            await expect(control).not.toHaveCSS('font-family', /TDAText/);
            await expect(control).not.toHaveClass(/crt-control/);
            await expect(control).toHaveCSS('font-size', '16px');
            const bounds = (await control.boundingBox())!;
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        }
    }
    await page.evaluate(() => document.fonts.ready);
    await footer.screenshot({ path: `.impeccable/review/crt-controls-footer-${testInfo.project.name}.png` });
    const gallery = page.getByRole('link', { name: 'Gallery', exact: true });
    await expect(gallery).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(gallery).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(footer.locator('.footer-link')).toHaveCSS('color', 'rgb(240, 240, 240)');
    await page.mouse.move(0, 0); await gallery.focus(); await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/gallery\/?$/);
    await expect(page.locator('.floating-gallery button').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('.floating-gallery .crt-control')).toHaveCount(0);
});

test('keeps the single X control functional with inverted pointer and keyboard states', async ({ page }, testInfo) => {
    await page.goto('/?crt=off');
    const trigger = page.locator('a[data-post-image]').first();
    await trigger.click();
    const viewer = page.getByRole('dialog', { name: 'Enlarged image' });
    const close = viewer.getByRole('button', { name: 'Close image', exact: true });
    await expect(viewer.getByRole('button')).toHaveCount(1);
    await expect(close).toBeFocused();
    await page.mouse.move(0, 0); await close.evaluate((element: HTMLElement) => element.blur());
    await colors(close);
    await expect(close).not.toHaveCSS('font-family', /TDAText/);
    expect((await close.boundingBox())!.width).toBe(44);
    expect((await close.boundingBox())!.height).toBe(44);
    await close.hover(); await colors(close, true);
    await expect(close.locator('svg')).toHaveCSS('stroke', 'rgb(0, 0, 0)');
    await page.mouse.move(0, 0); await close.focus(); await page.keyboard.press('Tab');
    await expect(close).toBeFocused(); await colors(close, true);
    await expect(close).toHaveCSS('outline-width', '4px');
    await page.screenshot({ path: `.impeccable/review/crt-controls-viewer-${testInfo.project.name}.png` });
    await page.keyboard.press('Escape'); await expect(viewer).not.toBeVisible(); await expect(trigger).toBeFocused();
    await trigger.click(); await close.click(); await expect(viewer).not.toBeVisible(); await expect(trigger).toBeFocused();
});

test('preserves legacy artwork and admin styling and works when the font cannot load', async ({ page }) => {
    await page.route('**/fonts/tdatext/TDAText.ttf', (route) => route.abort());
    await page.goto('/1.html');
    const enter = page.getByRole('link', { name: 'ENTER', exact: true });
    await expect(enter).not.toHaveCSS('font-family', /TDAText/);
    await expect(enter).not.toHaveClass(/crt-control/);
    let adminFontRequested = false;
    page.on('request', (request) => { if (request.url().includes('/fonts/tdatext/')) adminFontRequested = true; });
    await page.goto('/admin');
    const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(signIn).toHaveCSS('font-family', /system-ui/);
    await expect(signIn).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect(adminFontRequested).toBe(false);
    await page.goto('/gallery?crt=off');
    expect(await page.evaluate(async () => {
        try { await document.fonts.load('20px TDAText'); return false; } catch { return true; }
    })).toBe(true);
    const back = page.getByRole('link', { name: 'Back to posts', exact: true });
    await expect(back).toBeVisible();
    await colors(back); await back.click(); await expect(page).toHaveURL(/\/$/);
});
