import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

const assets = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/app.js': ['app.js', 'text/javascript'],
  '/style.css': ['style.css', 'text/css'],
  '/service-worker.js': ['service-worker.js', 'text/javascript'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json'],
  '/icons/pay-192.png': ['icons/pay-192.png', 'image/png'],
  '/icons/pay-512.png': ['icons/pay-512.png', 'image/png'],
  '/icons/pay-brand.webp': ['icons/pay-brand.webp', 'image/webp'],
  '/icons/pay-favicon.png': ['icons/pay-favicon.png', 'image/png']
};

export async function qualifyPwa(chromium, channel) {
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/deployment.json') return res.writeHead(200, { 'content-type': 'application/json' }).end('null');
    if (pathname === '/private-data') return res.writeHead(200).end('must-never-cache');
    const asset = assets[pathname];
    if (!asset) return res.writeHead(404).end();
    try {
      const bytes = await readFile(new URL('../dist/' + asset[0], import.meta.url));
      res.writeHead(200, { 'content-type': asset[1], 'cache-control': 'no-cache' }).end(bytes);
    } catch { res.writeHead(500).end(); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = 'http://127.0.0.1:' + server.address().port;
  const profile = await mkdtemp(join(tmpdir(), 'pay-pwa-profile-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, { channel });
    const page = await context.newPage();
    await page.goto(origin + '/#business');
    await page.getByText('Connect 420 Wallet to open that section.').waitFor();
    assert.equal(new URL(page.url()).hash, '');
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const cdp = await context.newCDPSession(page);
    const installability = await cdp.send('Page.getInstallabilityErrors');
    assert.deepEqual(installability.installabilityErrors, []);
    const cached = await page.evaluate(async () => {
      await Promise.all([
        fetch('/deployment.json', { cache: 'no-store' }),
        fetch('/private-data', { headers: { authorization: 'Bearer test-only' } })
      ]);
      const names = await caches.keys();
      return (await (await caches.open(names.find(name => name.startsWith('420pay-shell-')))).keys())
        .map(request => new URL(request.url).pathname).sort();
    });
    assert.deepEqual(cached, Object.keys(assets).filter(name => name !== '/' && name !== '/service-worker.js').sort());
    await page.getByRole('button', { name: 'Open fixture mode' }).click();
    await page.getByText('428.42 420', { exact: true }).waitFor();
    await context.setOffline(true);
    await page.getByText(/Only local drafts are available/).waitFor();
    assert.equal(await page.locator('#history li').count(), 0);
    await page.reload();
    await page.getByRole('heading', { name: 'Your account' }).waitFor();
    await page.locator('#offline-notice').waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.brand-image')].length === 2 &&
      [...document.querySelectorAll('.brand-image')].every(img => img.complete && img.naturalWidth === 352));
    assert.equal(await page.evaluate(async () => {
      const response = await fetch(document.querySelector('link[rel="icon"]').href);
      return response.ok && response.headers.get('content-type') === 'image/png';
    }), true);
    assert.equal(await page.locator('#history li').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Connect 420 Wallet' }).isDisabled(), true);
    assert.equal(await page.evaluate(async () => {
      try { await fetch('/deployment.json', { cache: 'no-store' }); return true; }
      catch { return false; }
    }), false);
    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine);
    await page.evaluate(() => {
      if (!document.getElementById('offline-notice').hidden) document.getElementById('retry-network').click();
    });
    await page.locator('#offline-notice').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Open fixture mode' }).waitFor();
    assert.equal(await page.locator('#history li').count(), 0);
    console.log('PASS: PWA installability, untrusted navigation, offline shell, cache allowlist and stale-state clearance');
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
    await new Promise(resolve => server.close(resolve));
  }
}
