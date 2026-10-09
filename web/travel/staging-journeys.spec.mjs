// Run only against the real HTTPS staging site:
// TRAVEL_STAGING_ORIGIN=https://... npx playwright test -c web/travel/playwright.config.mjs
import { test, expect } from '@playwright/test';

const origin = process.env.TRAVEL_STAGING_ORIGIN;
test.beforeAll(() => {
  if (!origin || !/^https:\/\/[^/]+$/.test(origin)) throw new Error('Real HTTPS TRAVEL_STAGING_ORIGIN is required');
});

test('public discovery is keyboard navigable without scripting', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const response = await page.goto(origin + '/travel', { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toMatch(/^(A|BUTTON|INPUT|SELECT)$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await context.close();
});

test('anonymous requests cannot view private trips or claims', async ({ page }) => {
  for (const path of ['/travel/trips', '/travel/business/claim', '/travel/business/claim/status/known-claim']) {
    const res = await page.goto(origin + path);
    expect([401, 403, 404, 503]).toContain(res?.status());
    const html = await page.content();
    expect(html).not.toMatch(/claimant_id|registry_record_id|evidence_ref|owner_id/i);
  }
});

test('public map retains an accessible non-JS discovery path', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const res = await page.goto(origin + '/travel/map');
  expect(res?.status()).toBe(200);
  const main = page.locator('main');
  await expect(main).toBeVisible();
  await expect(main.getByRole('heading').first()).toBeVisible();
  await context.close();
});
