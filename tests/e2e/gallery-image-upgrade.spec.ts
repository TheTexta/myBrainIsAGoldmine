import { test, expect, type Locator, type Page } from '@playwright/test';
import { localRequestsOnly } from '../support/browser';
import { gallerySize } from '../../src/lib/floating-images';
import sharp from 'sharp';

test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', localRequestsOnly);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/gallery?crt=off');
    await expect(page.locator('[data-floating-images]')).toHaveAttribute('data-motion', 'static');
});

async function imageUpgrade(page: Page, photo: Locator) {
    const image = await photo.locator('img').elementHandle();
    if (!image) throw new Error('The gallery photo has no image.');
    await image.evaluate(async (element: HTMLImageElement) => { await element.decode(); });
    const initial = await image.evaluate((element: HTMLImageElement) => ({ source: element.currentSrc, sizes: element.sizes,
        candidates: element.srcset.split(',').map((candidate) => { const [source, width] = candidate.trim().split(/\s+/); return { source: new URL(source, location.href).href, width: Number.parseInt(width) }; }) }));
    const viewport = page.viewportSize()!;
    const aspect = Number(await photo.getAttribute('data-aspect'));
    const pixels = gallerySize(aspect, viewport.width, viewport.height, true).width * await page.evaluate(() => devicePixelRatio);
    const candidates = initial.candidates.sort((a, b) => a.width - b.width);
    const source = (candidates.find((candidate) => candidate.width >= pixels) ?? candidates.at(-1)!).source;
    expect(source).not.toBe(initial.source);
    return { image, initial, source };
}

test('retains a decoded bitmap through a cold higher-resolution upgrade', async ({ page }) => {
    const photo = page.locator('[data-media-type="image"]').last();
    const upgrade = await imageUpgrade(page, photo);
    let release!: () => void, requested = false;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    await page.route((url) => url.href === upgrade.source, async (route) => { requested = true; await blocked; await route.continue(); });
    await photo.evaluate((element: HTMLElement) => {
        element.dataset.blankFrames = '0'; element.dataset.watchedFrames = '0';
        const watch = () => {
            if (!element.isConnected || element.dataset.stopWatching) return;
            if (element.getAttribute('aria-expanded') === 'true') {
                const ready = [...element.querySelectorAll('img')].some((image) => image.complete && image.naturalWidth > 0 && getComputedStyle(image).visibility !== 'hidden' && getComputedStyle(image).opacity !== '0');
                element.dataset.watchedFrames = String(Number(element.dataset.watchedFrames) + 1);
                if (!ready) element.dataset.blankFrames = String(Number(element.dataset.blankFrames) + 1);
            }
            requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
        element.click();
    });
    try {
        await expect(photo).toHaveAttribute('aria-expanded', 'true');
        await expect.poll(() => requested).toBe(true);
        await expect.poll(() => photo.getAttribute('data-watched-frames').then(Number)).toBeGreaterThan(3);
        expect(await upgrade.image.evaluate((image: HTMLImageElement) => image.isConnected && image.complete && image.naturalWidth > 0)).toBe(true);
        expect(await upgrade.image.evaluate((image: HTMLImageElement) => image.sizes)).toBe(upgrade.initial.sizes);
        expect(await upgrade.image.evaluate((image: HTMLImageElement) => image.currentSrc)).toBe(upgrade.initial.source);
    } finally { release(); }
    await expect.poll(() => upgrade.image.evaluate((image) => image.isConnected)).toBe(false);
    await expect(photo.locator('img')).toHaveCount(1);
    await expect.poll(() => photo.locator('img').evaluate((image: HTMLImageElement) => image.currentSrc)).toBe(upgrade.source);
    await expect(photo).toHaveAttribute('data-blank-frames', '0');
    await photo.evaluate((element: HTMLElement) => { element.dataset.stopWatching = 'true'; });
});

test('paints the previous or replacement bitmap on every upgrade frame while moving', async ({ page }) => {
    const bitmap = (background: string) => sharp({ create: { width: 480, height: 640, channels: 3, background } }).webp().toBuffer();
    const red = await bitmap('#ff0000'), blue = await bitmap('#0000ff');
    let highResolution = '', requested = false, release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    await page.route((url) => url.href.includes('img-1786'), async (route) => {
        if (route.request().url() === highResolution) { requested = true; await blocked; await route.fulfill({ contentType: 'image/webp', body: blue }); }
        else await route.fulfill({ contentType: 'image/webp', body: red });
    });
    await page.clock.install({ time: new Date('2026-11-10T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-11-10T12:00:01Z'));
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.reload();
    const photo = page.locator('[data-media-type="image"]').last();
    const upgrade = await imageUpgrade(page, photo); highResolution = upgrade.source;
    await photo.evaluate((element: HTMLButtonElement) => element.click()); await page.clock.runFor(32);
    await expect.poll(() => requested).toBe(true);
    const assertBitmap = async () => {
        const pixels = await sharp(await page.screenshot()).extract({ left: Math.floor(page.viewportSize()!.width / 2) - 4,
            top: Math.floor(page.viewportSize()!.height / 2) - 4, width: 8, height: 8 }).removeAlpha().raw().toBuffer();
        let reds = 0, blues = 0;
        for (let index = 0; index < pixels.length; index += 3) {
            if (pixels[index] > 220 && pixels[index + 1] < 25 && pixels[index + 2] < 25) reds++;
            if (pixels[index + 2] > 220 && pixels[index + 1] < 25 && pixels[index] < 25) blues++;
        }
        expect(Math.max(reds, blues), 'the moving photo must never reveal its background').toBe(64);
    };
    try { await assertBitmap(); } finally { release(); }
    await expect(photo.locator('img')).toHaveCount(2);
    const before = await photo.getAttribute('style');
    await assertBitmap();
    for (let frame = 0; frame < 5; frame++) { await page.clock.runFor(16); await assertBitmap(); }
    await expect(photo.locator('img')).toHaveCount(1);
    expect(await photo.getAttribute('style')).not.toBe(before);
    await expect(photo).toHaveAttribute('aria-expanded', 'true');
});

test('failed upgrades leave the current photo visible and expanded', async ({ page }) => {
    const photo = page.locator('[data-media-type="image"]').last();
    const upgrade = await imageUpgrade(page, photo);
    let requested = false;
    await page.route((url) => url.href === upgrade.source, (route) => { requested = true; return route.fulfill({ status: 503, body: '' }); });
    await photo.evaluate((element: HTMLButtonElement) => element.click());
    await expect.poll(() => requested).toBe(true);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(photo).toHaveAttribute('aria-expanded', 'true');
    await expect(photo.locator('img')).toHaveCount(1);
    expect(await upgrade.image.evaluate((image: HTMLImageElement) => image.isConnected && image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await upgrade.image.evaluate((image: HTMLImageElement) => image.currentSrc)).toBe(upgrade.initial.source);
});

test('a superseded upgrade never replaces another selection or blanks its original', async ({ page }) => {
    const photo = page.locator('[data-media-type="image"]').last(), other = page.locator('[data-media-type="image"]').first();
    const upgrade = await imageUpgrade(page, photo);
    let release!: () => void, requested = false;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    await page.route((url) => url.href === upgrade.source, async (route) => { requested = true; await blocked; await route.continue().catch(() => {}); });
    await photo.evaluate((element: HTMLButtonElement) => element.click());
    try {
        await expect.poll(() => requested).toBe(true);
        await other.evaluate((element: HTMLButtonElement) => element.click());
        await expect(other).toHaveAttribute('aria-expanded', 'true');
        await expect(photo).toHaveAttribute('aria-expanded', 'false');
    } finally { release(); }
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.locator('[aria-expanded="true"]')).toHaveCount(1);
    await expect(photo.locator('img')).toHaveCount(1);
    expect(await upgrade.image.evaluate((image: HTMLImageElement) => image.isConnected && image.complete)).toBe(true);
    expect(await upgrade.image.evaluate((image: HTMLImageElement) => image.currentSrc)).toBe(upgrade.initial.source);
});
