import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    timeout: 45_000,
    use: { baseURL: 'http://127.0.0.1:4323', trace: 'retain-on-failure' },
    projects: [
        { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
        { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    ],
    webServer: [
        { command: 'node tests/support/services.mjs', url: 'http://127.0.0.1:54329/health', reuseExistingServer: false },
        { command: 'npm run build && node dist/server/entry.mjs', url: 'http://127.0.0.1:4323', reuseExistingServer: false,
            env: { HOST: '127.0.0.1', PORT: '4323', PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
                PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key', SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
                R2_ENDPOINT: 'http://127.0.0.1:54329/r2', R2_BUCKET: 'mybrain-test',
                R2_ACCESS_KEY_ID: 'test-access-key', R2_SECRET_ACCESS_KEY: 'test-secret-not-a-credential' },
        },
    ],
});
