import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_SERVICES, buildAppCatalog, filterAppCatalog } from '../core/apps.js';
import { loadVerifiedApps } from '../apps-page.js';

test('app catalog includes expected core ecosystem gateways and metadata', () => {
  const ids = APP_SERVICES.map((app) => app.id);
  for (const id of ['swap', 'pay', 'explorer', 'ai', 'compute', 'registry', 'names', 'identity', 'search', 'appstore', 'analytics', 'verify', 'notifications', 'bridge', 'stake', 'governance', 'messenger', 'grants', 'launchpad', 'resource', 'rights', 'attention', 'cannaseur', 'status']) {
    assert.ok(ids.includes(id), `missing app ${id}`);
  }
  assert.equal(APP_SERVICES.find((app) => app.id === 'swap').featured, true);
});

test('app filtering supports category and free-text search without changing trust state', () => {
  const apps = buildAppCatalog(APP_SERVICES.map((app) => ({ ...app, available: app.id === 'swap', url: app.id === 'swap' ? 'https://swap.example/' : null })));
  assert.deepEqual(filterAppCatalog(apps, { category: 'finance' }).map((app) => app.id), ['treasury', 'grants', 'launchpad', 'token', 'market', 'swap', 'pay', 'bridge', 'stake']);
  assert.deepEqual(filterAppCatalog(apps, { query: 'governance' }).map((app) => app.id), ['arbitration', 'rights', 'governance']);
  assert.equal(apps.find((app) => app.id === 'swap').verified, true);
  assert.equal(apps.find((app) => app.id === 'bridge').verified, false);
});

test('420 Apps discovery enables only services from a verified manifest', async () => {
  const responses = [
    { ok: true, json: async () => ({ manifest: { url: 'https://manifest.example/apps.json' } }) },
    { ok: true, json: async () => ({
      schema: '420-ecosystem-manifest-v1',
      verified: true,
      services: [
        { serviceId: '420/service/swap/v1', name: '420 Swap', url: 'https://swap.example/' },
        { serviceId: '420/service/search/v1', name: '420 Search', url: 'https://search.example/' },
      ],
    }) },
  ];
  const result = await loadVerifiedApps(async () => responses.shift());
  assert.equal(result.trust, 'Verified manifest');
  assert.equal(result.apps.find((app) => app.id === 'swap').available, true);
  assert.equal(result.apps.find((app) => app.id === 'search').available, true);
  assert.equal(result.apps.find((app) => app.id === 'bridge').available, false);
});

test('420 Apps discovery fails closed on unverified manifest', async () => {
  const responses = [
    { ok: true, json: async () => ({ manifest: { url: 'https://manifest.example/apps.json' } }) },
    { ok: true, json: async () => ({ schema: '420-ecosystem-manifest-v1', verified: false, services: [] }) },
  ];
  await assert.rejects(loadVerifiedApps(async () => responses.shift()), /manifest is not verified/i);
});

test('420 Apps discovery leaves everything unavailable until a manifest is configured', async () => {
  const result = await loadVerifiedApps(async () => ({ ok: true, json: async () => ({ manifest: { url: null } }) }));
  assert.equal(result.trust, 'Awaiting manifest');
  assert.ok(result.apps.every((app) => app.available === false && app.url === null));
});
