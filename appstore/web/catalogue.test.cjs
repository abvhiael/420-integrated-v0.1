const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const script = readFileSync(require.resolve('./static/app.js'), 'utf8');
const [pay] = require('../curation/genesis-apps.json');

async function render(hash, { registryAvailable = true } = {}) {
  const route = { innerHTML: '' };
  const requests = [];
  await vm.runInNewContext(script, {
    URLSearchParams,
    location: { hash },
    document: { getElementById: id => id === 'route-content' ? route : { addEventListener() {} } },
    window: { addEventListener() {} },
    fetch: async path => {
      requests.push(path);
      const curated = path.startsWith('/v1/apps/curated');
      const items = curated ? [pay] : [{ serviceId: pay.serviceId, active: true, version: 1 }];
      return { ok: curated || registryAvailable, status: 503, json: async () => ({ items }) };
    },
  });
  return { html: route.innerHTML, requests };
}

test('Pay appears once and is discoverable from search and categories', async () => {
  for (const [hash, path] of [
    ['#/browse', '/v1/apps/curated'],
    ['#/search/checkout', '/v1/apps/curated?q=checkout'],
    ['#/category/payments', '/v1/apps/curated?category=payments'],
  ]) {
    const { html, requests } = await render(hash);
    assert.ok(requests.includes(path));
    assert.equal((html.match(/<h2>420 Pay<\/h2>/g) || []).length, 1);
    assert.match(html, /#\/curated\/420%2Fservice%2Fpay%2Fv1/);
    assert.doesNotMatch(html, /version 1/);
  }
});

test('curated Pay remains visible during Registry outage and exposes only navigation', async () => {
  const { html: browse } = await render('#/browse', { registryAvailable: false });
  assert.match(browse, /Registry-backed listings are unavailable/);
  assert.match(browse, /420 Pay/);
  const { html } = await render('#/curated/' + encodeURIComponent(pay.serviceId), { registryAvailable: false });
  assert.match(html, /apps\/pay\/user-guide\//);
  assert.match(html, /Check Registry-backed details/);
  for (const expression of pay.expressions) assert.ok(html.includes(expression.name));
  assert.equal((html.match(/>Planned</g) || []).length, 7);
  assert.doesNotMatch(html, /pay\.420integrated\.org|Open in 420Wallet|Direct app/);
});
