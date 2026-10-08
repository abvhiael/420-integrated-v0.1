const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.log('[RR9 PAGEERROR]', error.stack || error.message));
  page.on('console', message => { if (message.type() === 'error') console.log('[RR9 CONSOLE]', message.text()); });
  await page.route('**/v1/news/sources', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ sources: [{id:'source-a',name:'Source A',home_url:'https://publisher.example',attribution:'Source A'}] })
  }));
  await page.route('**/v1/news/topics', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ topics: ['policy'] })
  }));
  await page.route('**/v1/news?*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({items:[{id:'news-1',source_id:'source-a',source_name:'Source A',title:'Cannabis policy update',summary:'Independent report',canonical_url:'https://publisher.example/story',attribution:'Source A'}],next_cursor:''})
  }));
  await page.route('**/v1/publications?*', route => route.fulfill({
    status:200, contentType:'application/json', body:JSON.stringify({items:[],next_cursor:''})
  }));
  await page.route('**/v1/editorial/publications**', route => route.fulfill({
    status:401,contentType:'application/json',body:JSON.stringify({error:'SESSION_REQUIRED'})
  }));
});

test('anonymous news is attributed and links to original without script injection', async ({page}) => {
  await page.goto('http://127.0.0.1:8765/#news');
  await expect(page.getByRole('heading', {name:'Cannabis News'})).toBeVisible();
  await expect(page.getByText('Cannabis policy update')).toBeVisible();
  const original=page.getByRole('link',{name:/Read original article at Source A/});
  await expect(original).toHaveAttribute('href','https://publisher.example/story');
  await expect(original).toHaveAttribute('rel',/noopener/);
  await expect(page.locator('#news-feed article[data-kind="external-news"] .attribution')).toBeVisible();
});

test('protected editorial route fails closed without verified wallet', async ({page}) => {
  await page.goto('http://127.0.0.1:8765/#editorial');
  await expect(page.getByText(/Not connected/)).toBeVisible();
  await page.getByRole('button',{name:'Connect Wallet'}).click();
  await expect(page.getByRole('status')).toContainText('qualified 420 Wallet authentication gateway is not available');
});

test('mobile navigation and skip link remain keyboard-accessible', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:8765/#news');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to content'})).toBeFocused();
  await page.getByRole('link',{name:'Topics',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Topics'})).toBeVisible();
});

test('anonymous news page has no serious accessibility violations', async ({page}) => {
  await page.goto('http://127.0.0.1:8765/#news');
  await expect(page.getByText('Cannabis policy update')).toBeVisible();
  const scan=await new AxeBuilder({page}).analyze();
  expect(scan.violations.filter(v=>['critical','serious'].includes(v.impact))).toEqual([]);
});
