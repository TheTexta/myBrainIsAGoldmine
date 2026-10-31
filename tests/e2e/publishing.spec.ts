import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

async function signIn(page: Page, email = 'editor@local.test') {
    await page.goto('/admin');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('test-only-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
test.beforeEach(async ({ page, request }) => {
    await request.post('http://127.0.0.1:54329/__reset');
    await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});

test('writes, saves privately, previews, publishes, uploads, and unpublishes', async ({ page, request }, testInfo) => {
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await signIn(page);
    await page.getByRole('button', { name: 'New entry', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('A new BlockNote entry');
    await page.locator('.bn-editor').fill('Words saved in BlockNote, not MDX.');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Draft saved. The live site has not changed.' })).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/admin-${testInfo.project.name}.png`, fullPage: true });
    expect(await (await request.get('/')).text()).not.toContain('A new BlockNote entry');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
    await expect(page.frameLocator('iframe[title="Saved draft preview"]').locator('link[href*="family=Tinos"]')).toHaveCount(1);
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
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Published. The live site' })).toBeVisible();
    const original = await readFile('public/assets/favicon/favicon-96x96.png');
    const published = await request.get(media.url); expect(published.status()).toBe(200);
    expect(createHash('sha256').update(await published.body()).digest('hex')).toBe(createHash('sha256').update(original).digest('hex'));
    // Reusing an earlier browser upload capability cannot replace sealed bytes.
    await request.put(reservation.url, { data: Buffer.alloc(original.length, 0), headers: { 'Content-Type': 'image/png' } });
    expect(await (await request.get(media.url)).body()).toEqual(original);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Unpublished. Your saved draft' })).toBeVisible();
    expect(await (await request.get('/')).text()).not.toContain('A new BlockNote entry');
    expect((await request.get(media.url)).status()).toBe(404);
    expect(errors).toEqual([]);
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
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
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
