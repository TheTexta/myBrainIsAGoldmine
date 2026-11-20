import { test, expect } from '@playwright/test';
import type {} from '../fixtures/legacy-import/main';

test('matches frozen DOMParser imports for every public entry and adversarial HTML', async ({ page }) => {
    const external: string[] = [];
    await page.route('**/*', (route) => {
        if (new URL(route.request().url()).origin === 'http://127.0.0.1:4323') return route.continue();
        external.push(route.request().url()); return route.abort();
    });
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.legacyImportDifferential));
    const cases = await page.evaluate(() => window.legacyImportDifferential.cases);
    expect(cases).toHaveLength(17);
    let textRuns = 0, mediaBlocks = 0;
    for (const fixture of cases) {
        await test.step(fixture.name, async () => {
            const result = await page.evaluate((html) => window.legacyImportDifferential.compare(html), fixture.html);
            expect(result.extracted.fragments, 'HTML fragments given to the actual BlockNote parser').toEqual(result.reference.fragments);
            expect(result.extracted.ordered, 'ordered text and media (not media totals)').toEqual(result.reference.ordered);
            expect(result.extracted.blocks, 'actual resulting BlockNote documents, ignoring generated IDs only').toEqual(result.reference.blocks);
            const ordered = result.extracted.ordered as { text?: string; type?: string }[];
            textRuns += ordered.filter((item) => item.text?.trim()).length;
            mediaBlocks += ordered.filter((item) => item.type === 'image' || item.type === 'embed').length;
            if (fixture.name.startsWith('archive ')) expect(ordered.some((item) => item.text?.trim())).toBe(true);
        });
    }
    expect(textRuns).toBeGreaterThan(100);
    expect(mediaBlocks).toBeGreaterThanOrEqual(23);
    expect(await page.evaluate(() => window.__legacyImportExecuted)).toBeUndefined();
    // Browser parsing may attempt legacy image loads; all non-local traffic is
    // blocked before it can leave the fixture. No network content is required.
    test.info().annotations.push({ type: 'coverage', description: `${cases.length} fixtures; ${textRuns} non-empty text runs; ${mediaBlocks} ordered media blocks; ${external.length} external resource requests blocked` });
});
