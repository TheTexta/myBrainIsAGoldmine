import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { localRequestsOnly } from '../support/browser';

async function signIn(page: Page, email = 'editor@local.test') {
    await page.goto('/admin');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('test-only-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', localRequestsOnly);
});

test('writes, saves privately, previews, publishes, uploads, and unpublishes', async ({ page, request }, testInfo) => {
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await signIn(page);
    await page.getByRole('button', { name: 'New entry', exact: true }).click();
    if (testInfo.project.name === 'mobile') {
        await expect(page.getByRole('button', { name: 'Choose entry', exact: true })).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('#entry-inventory')).not.toBeVisible();
        await expect(page.getByLabel('Title', { exact: true })).toBeFocused();
    }
    await page.getByLabel('Title', { exact: true }).fill('A new BlockNote entry');
    await page.locator('.bn-editor').fill('Words saved in BlockNote, not MDX.');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved. The live site has not changed.' })).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/admin-${testInfo.project.name}.png`, fullPage: true });
    expect(await (await request.get('/')).text()).not.toContain('A new BlockNote entry');
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Published. The live site' })).toBeVisible();
    expect(await (await request.get('/')).text()).toContain('Words saved in BlockNote, not MDX.');

    const reservationPromise = page.waitForResponse((response) => response.url().endsWith('/api/admin/media') && response.request().method() === 'POST');
    const completionPromise = page.waitForResponse((response) => /\/api\/admin\/media\/[a-f0-9-]+$/.test(response.url()) && response.request().method() === 'POST');
    await page.getByText('Images and embeds', { exact: true }).click();
    await page.getByLabel('Upload image', { exact: true }).setInputFiles('public/assets/favicon/favicon-96x96.png');
    const reservation = await (await reservationPromise).json();
    const completed = await completionPromise;
    expect(completed.status(), await completed.text()).toBe(200);
    const media = await completed.json();
    expect((await request.get(media.url)).status()).toBe(404);
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    const preview = page.frameLocator('iframe[title="Post preview"]');
    await expect(preview.locator('link[href*="family=Tinos"]')).toHaveCount(1);
    await expect(preview.locator('link[rel="stylesheet"]').first()).toHaveAttribute('href', /\/_astro\/public\.[\w-]+\.css$/);
    await expect(preview.locator('.content')).toHaveCSS('border-top-width', '0px');
    await expect(preview.locator('.content')).toHaveCSS('background-image', /white-recycle-paper-texture/);
    await expect(preview.locator('.content')).toHaveCSS('color', 'rgb(24, 24, 24)');
    expect(await preview.locator('body').evaluate((element) => element.style.getPropertyValue('--post-paper'))).toBe('');
    await expect(preview.locator('.content')).toHaveCSS('padding-top', '0px');
    await expect(preview.locator('.content')).toHaveCSS('padding-bottom', '0px');
    await expect(preview.locator('.content')).toHaveCSS('padding-left', testInfo.project.name === 'mobile' ? '4px' : '0px');
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await expect(page.locator('.bn-editor img')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Update live post', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Update live post', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Published. The live site' })).toBeVisible();
    const original = await readFile('public/assets/favicon/favicon-96x96.png');
    const published = await request.get(media.url); expect(published.status()).toBe(200);
    expect(createHash('sha256').update(await published.body()).digest('hex')).toBe(createHash('sha256').update(original).digest('hex'));
    // Reusing an earlier browser upload capability cannot replace sealed bytes.
    await request.put(reservation.url, { data: Buffer.alloc(original.length, 0), headers: { 'Content-Type': 'image/png' } });
    expect(await (await request.get(media.url)).body()).toEqual(original);
    page.once('dialog', (dialog) => dialog.accept());
    await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
    await expect(page.locator('details').filter({ has: page.getByRole('button', { name: 'Unpublish', exact: true }) })).toHaveCount(0);
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Unpublished. Your saved draft' })).toBeVisible();
    expect(await (await request.get('/')).text()).not.toContain('A new BlockNote entry');
    expect((await request.get(media.url)).status()).toBe(404);
    expect(errors).toEqual([]);
});

test('keeps BlockNote typography and geometry independent of site styling', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'New entry', exact: true }).click();
    await expect(page.locator('.bn-editor')).toBeVisible();
    const metrics = await page.evaluate(async () => {
        await document.fonts.ready;
        const stylesheet = [...document.styleSheets].find((sheet) => sheet.href?.includes('/_astro/admin.'));
        if (!stylesheet) throw new Error('The site admin stylesheet is missing.');
        const read = () => ['.bn-editor', '.bn-block-content'].map((selector) => {
            const element = document.querySelector(selector)!;
            const style = getComputedStyle(element);
            return [style.fontFamily, style.fontSize, style.lineHeight, style.padding, style.borderWidth];
        });
        const withSiteStyles = read();
        stylesheet.disabled = true;
        const vendorOnly = read();
        stylesheet.disabled = false;
        return { withSiteStyles, vendorOnly };
    });
    expect(metrics.withSiteStyles).toEqual(metrics.vendorOnly);
    const siteCss = await readFile('src/styles/admin.css', 'utf8');
    expect(siteCss).not.toMatch(/\.(?:bn-|mantine-)/);
    await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toHaveCSS('border-top-width', '4px');
});

test('keeps mobile publishing controls visible without a stretched entry picker', async ({ page }, testInfo) => {
    await signIn(page);
    await page.getByRole('button', { name: 'New entry', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('A long entry title that stays usable on a narrow phone');
    await page.locator('.bn-editor').fill('Mobile publishing without hidden actions.');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Live · all changes published' })).toBeVisible();
    for (const width of [320, 390, 760, 768, 1024]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        for (const name of ['Save draft', 'Update live post', 'Unpublish']) {
            const button = page.getByRole('button', { name, exact: true });
            await expect(button).toBeVisible();
            const bounds = await button.boundingBox();
            expect(bounds!.height).toBeGreaterThanOrEqual(44);
            expect(bounds!.x).toBeGreaterThanOrEqual(0);
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        }
        if (width <= 760) expect((await page.getByRole('complementary', { name: 'Entries' }).boundingBox())!.height).toBeLessThan(100);
    }
    await page.setViewportSize(testInfo.project.use.viewport!);
    await page.screenshot({ path: `.impeccable/review/admin-live-${testInfo.project.name}.png`, fullPage: true });
    await page.getByLabel('Title', { exact: true }).fill('Keep these unsaved edits');
    await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeDisabled();
    await expect(page.getByText('Save your draft before unpublishing.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeEnabled();
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved · changes not published' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeEnabled();
});

test('imports existing writing and retains Spotify embeds without publishing on save', async ({ page, request }) => {
    await signIn(page);
    await page.getByRole('button', { name: /I am not your manic pixie freak/ }).click();
    await page.getByRole('button', { name: 'Import original into BlockNote' }).click();
    await expect(page.locator('.editor-embed')).toHaveCount(3);
    await expect(page.locator('.bn-editor')).toContainText('Purple Haze');
    await page.getByLabel('Title', { exact: true }).fill('Revised title, still private');
    const saved = page.waitForRequest((req) => req.url().endsWith('/api/admin/posts') && req.method() === 'POST');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    expect((await saved).postDataJSON().document.filter((block: { type: string }) => block.type === 'embed')).toHaveLength(3);
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved. The live site has not changed.' })).toBeVisible();
    expect(await (await request.get('/')).text()).not.toContain('Revised title, still private');
});

test('imports original image filenames as portable same-origin paths', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /Back by popular request/ }).click();
    await page.getByRole('button', { name: 'Import original into BlockNote' }).click();
    await expect(page.locator('.bn-editor img')).toHaveCount(3);
    const saved = page.waitForRequest((req) => req.url().endsWith('/api/admin/posts') && req.method() === 'POST');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    const images = (await saved).postDataJSON().document.filter((block: { type: string }) => block.type === 'image');
    expect(images.map((block: { props: { url: string } }) => block.props.url)).toEqual(['/img_3134.png', '/pen_n_cry.jpg', '/Image%203132.png']);
});

test('rejects missing authorization, cross-origin writes, and other-site identities', async ({ page, request }) => {
    expect((await request.get('/api/admin/posts')).status()).toBe(401);
    await signIn(page, 'outsider@local.test');
    await expect(page.getByRole('alert')).toContainText('does not have editorial access');
    await expect(page.getByRole('button', { name: 'New entry', exact: true })).toHaveCount(0);
    const signed = await request.post('http://127.0.0.1:54329/auth/v1/token', { data: { email: 'editor@local.test' } });
    const { access_token } = await signed.json();
    const response = await request.post('/api/admin/publish', { headers: { Authorization: `Bearer ${access_token}`, Origin: 'https://evil.test' }, data: {} });
    expect(response.status()).toBe(403);
    const admin = await request.get('/admin'); const html = await admin.text();
    expect(admin.headers()['x-robots-tag']).toContain('noindex');
    expect(html).not.toContain('test-service-role'); expect(html).not.toContain('test-secret-not-a-credential');
});

test('retains local text when another editing session saves first', async ({ page, request }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'New entry', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Concurrent editing');
    await page.locator('.bn-editor').fill('Initial draft');
    const firstSave = page.waitForResponse((response) => response.url().endsWith('/api/admin/posts') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    const saved = await (await firstSave).json();
    const signed = await request.post('http://127.0.0.1:54329/auth/v1/token', { data: { email: 'editor@local.test' } });
    const { access_token } = await signed.json();
    expect((await request.post('/api/admin/posts', { headers: { Authorization: `Bearer ${access_token}`, Origin: 'http://127.0.0.1:4323' },
        data: { id: saved.id, revision: saved.revision, title: 'Saved in another session', document: saved.document } })).status()).toBe(200);
    await page.locator('.bn-editor').fill('Keep my unsaved local writing');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('changed elsewhere');
    await expect(page.locator('.bn-editor')).toContainText('Keep my unsaved local writing');
    await expect(page.getByRole('status').filter({ hasText: 'Unsaved changes' })).toBeVisible();
});

test('rejects a non-image disguised as a PNG before sealing it', async ({ request }) => {
    const signed = await request.post('http://127.0.0.1:54329/auth/v1/token', { data: { email: 'editor@local.test' } });
    const { access_token } = await signed.json();
    const headers = { Authorization: `Bearer ${access_token}`, Origin: 'http://127.0.0.1:4323' };
    const bytes = Buffer.from('<svg onload="alert(1)"></svg>');
    const reservation = await (await request.post('/api/admin/media', { headers, data: { size: bytes.length, type: 'image/png' } })).json();
    await request.put(reservation.url, { data: bytes, headers: { 'Content-Type': 'image/png' } });
    const complete = await request.post(`/api/admin/media/${reservation.id}`, { headers, data: {} });
    expect(complete.status()).toBe(400);
    expect((await request.get(`/media/${reservation.id}`)).status()).toBe(404);
});

test('publishes current edits directly and preserves pending-draft status after reload', async ({ page, request }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'New entry', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Direct publication');
    await page.locator('.bn-editor').fill('The first live version.');
    const actions: string[] = [];
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/admin/')) actions.push(new URL(request.url()).pathname); });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Published. The live site' })).toBeVisible();
    expect(actions).toEqual(['/api/admin/posts', '/api/admin/publish']);
    await expect(page.getByRole('status').filter({ hasText: 'Live · all changes published' })).toBeVisible();
    await page.locator('.bn-editor').fill('A private saved change.');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved · changes not published' })).toBeVisible();
    const live = await (await request.get('/')).text();
    expect(live).toContain('The first live version.'); expect(live).not.toContain('A private saved change.');
    await page.reload();
    await page.getByRole('button', { name: /Direct publication/ }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved · changes not published' })).toBeVisible();
    await page.getByRole('button', { name: 'Update live post', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Live · all changes published' })).toBeVisible();
    expect(await (await request.get('/')).text()).toContain('A private saved change.');
});

test('previews unsaved text without saving or losing it on return to Write', async ({ page, request }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'New entry', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Preview without saving');
    await page.locator('.bn-editor').fill('Keep this unsaved text.');
    let saves = 0;
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/admin/posts')) saves++; });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.frameLocator('iframe[title="Post preview"]').locator('body')).toContainText('Keep this unsaved text.');
    expect(saves).toBe(0);
    expect(await (await request.get('/')).text()).not.toContain('Preview without saving');
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await expect(page.locator('.bn-editor')).toContainText('Keep this unsaved text.');
    await expect(page.getByRole('status').filter({ hasText: 'Unsaved changes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
});

test('retains the saved draft and revision when publishing cannot be confirmed', async ({ page, request }) => {
    await signIn(page);
    await page.getByRole('button', { name: 'New entry', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Recoverable publishing');
    await page.locator('.bn-editor').fill('This draft must not disappear.');
    let saves = 0;
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/api/admin/posts')) saves++; });
    const unavailable = (route: import('@playwright/test').Route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporarily unavailable.' }) });
    await page.route('**/api/admin/publish', unavailable);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Draft saved. Publishing could not be confirmed');
    await expect(page.locator('.bn-editor')).toContainText('This draft must not disappear.');
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved · not on site' })).toBeVisible();
    expect(await (await request.get('/')).text()).not.toContain('Recoverable publishing');
    await page.unroute('**/api/admin/publish', unavailable);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Live · all changes published' })).toBeVisible();
    expect(saves).toBe(1);
    expect(await (await request.get('/')).text()).toContain('This draft must not disappear.');
});
