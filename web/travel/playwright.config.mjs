import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir: '.',
 testMatch: 'staging-journeys.spec.mjs',
 timeout: 30000,
 retries: 0,
 reporter: 'list',
 use: { ...devices['Desktop Chrome'], ignoreHTTPSErrors: false, trace: 'retain-on-failure' }
});
