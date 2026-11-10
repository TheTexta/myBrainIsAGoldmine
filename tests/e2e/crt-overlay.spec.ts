import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { localRequestsOnly } from '../support/browser';

test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', localRequestsOnly);
});

test('mounts the transparent, inert CRT overlay on the homepage and alias only', async ({ page }, testInfo) => {
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const canvas = page.locator('[data-crt-overlay]');
    await expect(canvas).toHaveAttribute('data-crt', 'lottes');
    await expect(canvas).toHaveAttribute('aria-hidden', 'true');
    await expect(canvas).toHaveAttribute('inert', '');
    await expect(canvas).toHaveCSS('pointer-events', 'none');
    await expect(canvas).toHaveCSS('mix-blend-mode', 'multiply');
    expect(await canvas.evaluate((element: HTMLCanvasElement) => element.getContext('webgl2')!.getContextAttributes()!.premultipliedAlpha)).toBe(true);
    expect(await canvas.evaluate((element) => element.parentElement === document.body && !element.hasAttribute('popover'))).toBe(true);
    const area = await canvas.evaluate((element: HTMLCanvasElement) => element.width * element.height);
    expect(area).toBeGreaterThan(100_000); expect(area).toBeLessThanOrEqual(2_000_000);
    expect(await page.locator('.cat-toggle').evaluate((element) => element.getBoundingClientRect().left)).toBe(0);
    await page.screenshot({ path: `.impeccable/review/crt-${testInfo.project.name}.png` });
    await page.goto('/index.html');
    await expect(canvas).toHaveAttribute('data-crt', 'lottes');
    for (const path of ['/1.html', '/12.html', '/3.html', '/admin']) {
        await page.goto(path); await expect(canvas).toHaveCount(0);
    }
    expect(errors).toEqual([]);
});

for (const fallback of [false, true]) test(`multiplies page pixels without a pale veil through resize (${fallback ? 'without Popover API' : 'with Popover API'})`, async ({ page }, testInfo) => {
    if (fallback) await page.addInitScript(() => Object.defineProperty(HTMLElement.prototype, 'showPopover', { value: undefined, configurable: true }));
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/');
    await expect(page.locator('[data-crt-overlay]')).toHaveAttribute('data-crt', 'lottes');
    await page.evaluate(() => {
        for (const [index, color] of ['#fff', '#000', '#c020a0'].entries()) {
            const patch = document.createElement('div'); patch.dataset.crtPagePatch = '';
            patch.style.cssText = `position:fixed;left:${32 + index * 64}px;top:128px;width:48px;height:48px;background:${color};z-index:2147483646`;
            document.body.append(patch);
        }
    });
    for (const width of [testInfo.project.use.viewport!.width, 2300]) {
        await page.setViewportSize({ width, height: 900 });
        const screenshot = await page.screenshot();
        const white = await sharp(screenshot).extract({ left: 32, top: 128, width: 48, height: 48 }).removeAlpha().raw().toBuffer();
        expect(Math.min(...white), 'white must reveal scanlines').toBeLessThan(250);
        const black = await sharp(screenshot).extract({ left: 96, top: 128, width: 48, height: 48 }).removeAlpha().raw().toBuffer();
        expect(Math.max(...black), 'multiply must leave black black, not create a pale veil').toBe(0);
        const color = await sharp(screenshot).extract({ left: 160, top: 128, width: 48, height: 48 }).removeAlpha().raw().toBuffer();
        for (let index = 0; index < color.length; index++) expect(color[index], 'multiply must not brighten saturated colour').toBeLessThanOrEqual([192, 32, 160][index % 3] + 1);
    }
});

for (const fallback of [false, true]) test(`stays above native dialogs with all input passing through (${fallback ? 'without Popover API' : 'with Popover API'})`, async ({ page }, testInfo) => {
    if (fallback) await page.addInitScript(() => Object.defineProperty(HTMLElement.prototype, 'showPopover', { value: undefined, configurable: true }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const canvas = page.locator('[data-crt-overlay]');
    await expect(canvas).toHaveAttribute('data-crt', 'lottes');
    await canvas.evaluate((element) => {
        element.dataset.events = '0';
        for (const type of ['click', 'mousedown', 'mouseup', 'mousemove', 'pointerdown', 'pointerup', 'pointermove', 'wheel', 'touchstart', 'touchend']) {
            element.addEventListener(type, () => { element.dataset.events = String(Number(element.dataset.events) + 1); });
        }
    });
    await page.getByRole('button', { name: 'Show Pinterest link', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Hide Pinterest link', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await page.locator('a[data-post-image]').first().click();
    const viewer = page.getByRole('dialog', { name: 'Enlarged image' });
    await expect(viewer).toBeVisible();
    await expect.poll(() => canvas.evaluate((element) => element.parentElement?.tagName)).toBe('DIALOG');
    await viewer.evaluate((element) => {
        for (const [index, color] of ['white', 'black'].entries()) {
            const patch = document.createElement('div'); patch.dataset.crtTestPatch = color;
            patch.style.cssText = `position:fixed;left:${32 + index * 64}px;top:128px;width:48px;height:48px;background:${color};z-index:2147483646`;
            patch.addEventListener('click', () => { patch.dataset.clicked = 'true'; }); element.append(patch);
        }
    });
    const capture = await page.screenshot();
    const white = await sharp(capture).extract({ left: 32, top: 128, width: 48, height: 48 }).removeAlpha().raw().toBuffer();
    expect(Math.min(...white)).toBeLessThan(250); expect(Math.max(...white)).toBeGreaterThan(250);
    const black = await sharp(capture).extract({ left: 96, top: 128, width: 48, height: 48 }).removeAlpha().raw().toBuffer();
    expect(Math.max(...black)).toBe(0);
    await page.locator('[data-crt-test-patch="white"]').click();
    await expect(page.locator('[data-crt-test-patch="white"]')).toHaveAttribute('data-clicked', 'true');
    await page.locator('[data-crt-test-patch]').evaluateAll((elements) => elements.forEach((element) => element.remove()));
    await page.screenshot({ path: `.impeccable/review/crt-viewer-${fallback ? 'fallback-' : ''}${testInfo.project.name}.png` });
    await page.getByRole('button', { name: 'Close image', exact: true }).click();
    await expect(viewer).not.toBeVisible();
    await expect(canvas).toHaveAttribute('data-events', '0');
    await expect(canvas).toHaveAttribute('data-crt', 'lottes');
    expect(await canvas.evaluate((element) => element.parentElement === document.body)).toBe(true);
});

test('keeps a static reduced-motion background without WebGL and supports opt-out', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
            return type === 'webgl2' ? null : Reflect.apply(original, this, [type, ...args]);
        } as typeof original;
    });
    await page.goto('/');
    await expect(page.locator('[data-crt-overlay]')).toHaveAttribute('data-crt', 'off');
    await expect(page.locator('[data-crt-overlay]')).toBeHidden();
    await expect(page.locator('body')).toHaveCSS('background-image', /glitter\.gif/);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('body')).toHaveCSS('background-image', /glitter-still\.png/);
    await page.goto('/?crt=off');
    await expect(page.locator('[data-crt-overlay]')).toHaveAttribute('data-crt', 'off');
    await page.screenshot({ path: `.impeccable/review/crt-off-${testInfo.project.name}.png` });
});

test('removes the overlay cleanly after GPU context loss', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('[data-crt-overlay]');
    await expect(canvas).toHaveAttribute('data-crt', 'lottes');
    await canvas.evaluate((element: HTMLCanvasElement) => element.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
    await expect(canvas).toHaveAttribute('data-crt', 'off'); await expect(canvas).toBeHidden();
    await expect(page.getByRole('button', { name: 'U WANNA STEAL MY SWAG', exact: true })).toBeVisible();
});

test('visibly treats glitter and keeps the same scanlines while the document scrolls', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const region = { left: page.viewportSize()!.width - 32, top: 160, width: 16, height: 64 };
    const pixels = async () => sharp(await page.screenshot()).extract(region).removeAlpha().raw().toBuffer();
    await page.goto('/'); await expect(page.locator('[data-crt-overlay]')).toHaveAttribute('data-crt', 'lottes');
    const treated = await pixels();
    await page.goto('/?crt=off'); await expect(page.locator('[data-crt-overlay]')).toHaveAttribute('data-crt', 'off');
    const original = await pixels();
    expect(treated.filter((value, index) => value !== original[index]).length).toBeGreaterThan(100);
    await page.goto('/'); await expect(page.locator('[data-crt-overlay]')).toHaveAttribute('data-crt', 'lottes');
    await page.evaluate(() => {
        const patch = document.createElement('div'); patch.dataset.viewportTest = '';
        patch.style.cssText = 'position:fixed;inset:0;background:white;z-index:2147483646;pointer-events:none';
        document.body.append(patch);
    });
    const before = await pixels();
    await page.evaluate(() => window.scrollTo(0, 1000));
    const after = await pixels();
    expect(after.equals(before)).toBe(true);
    expect(await page.locator('[data-crt-overlay]').evaluate((element) => element.getBoundingClientRect().top)).toBe(0);
});
