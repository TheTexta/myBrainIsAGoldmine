import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Keep cross-engine graphics coverage focused; unrelated owner-accepted layout
// regressions in the full suite must not obscure compositor failures.
export default defineConfig({
    ...base,
    testMatch: ['**/crt-overlay.spec.ts', '**/gallery.spec.ts'],
    projects: (['chromium', 'webkit'] as const).flatMap((browserName) => [
        { name: `${browserName}-desktop`, use: { browserName, viewport: { width: 1440, height: 900 } } },
        { name: `${browserName}-mobile`, use: { browserName, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    ]),
});
