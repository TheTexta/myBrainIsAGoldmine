import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    testMatch: 'legacy-import.spec.ts',
    fullyParallel: false,
    workers: 1,
    use: { baseURL: 'http://127.0.0.1:4323' },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
    webServer: { command: 'node tests/support/legacy-import-server.mjs', url: 'http://127.0.0.1:4323', reuseExistingServer: false },
});
