import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPublicFeedHttpServer } from '../src/publicFeedServer.js';

const objectId = `0x${'1'.repeat(64)}`;
const author = `0x${'a'.repeat(40)}`;
const object = { objectId, author, objectType: 'POST', status: 'ACTIVE', audienceType: 'PUBLIC', contentHash: `0x${'b'.repeat(64)}`, version: 1 };
function view() {
  return { checkpoint: { chainId: 420, indexedBlock: 55 },
    profiles: new Map([[author, { active: true }]]),
    socialObjects: new Map([[objectId, object]]),
    feeds: new Map([['DISCOVER:*', [{ objectId, feedClass: 'DISCOVER', viewerKey: '*' }]]]) };
}
async function withServer(options, check) {
  const server = createPublicFeedHttpServer(options);
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    await check(`http://127.0.0.1:${address.port}`);
  } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('public route never opens by default, even when dependencies are injected', async () => {
  await withServer({ getView: async () => view(), canShowPublicObject: async () => true }, async base => {
    const response = await fetch(`${base}/v1/public-feed`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { apiVersion: 'bg-social-read-v1', error: { code: 'unavailable' } });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('enabled route still fails closed without a canonical view or policy', async () => {
  await withServer({ enabled: true, getView: async () => view() }, async base => {
    assert.equal((await fetch(`${base}/v1/public-feed`)).status, 503);
  });
});

test('real HTTP GET returns only policy-authorized public projection with canonical origin header', async () => {
  await withServer({ enabled: true, getView: async () => view(), canShowPublicObject: async () => true }, async base => {
    const response = await fetch(`${base}/v1/public-feed?feedClass=DISCOVER&limit=1`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://bonggoggles.420integrated.org');
    const payload = await response.json();
    assert.equal(payload.data.items.length, 1);
    assert.equal(payload.data.items[0].objectId, objectId);
    assert.equal(payload.data.authoritative, false);
    assert.equal(JSON.stringify(payload).includes('secret'), false);
    assert.equal((await fetch(`${base}/v1/public-feed`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/v1/public-feed?feedClass=FRIENDS`)).status, 400);
    assert.equal((await fetch(`${base}/v1/public-feed`, { headers: { cookie: 'session=test' } })).status, 503);
  });
});

test('policy rejection and policy failure never return a public item', async () => {
  await withServer({ enabled: true, getView: async () => view(), canShowPublicObject: async () => false }, async base => {
    const payload = await (await fetch(`${base}/v1/public-feed`)).json();
    assert.deepEqual(payload.data.items, []);
  });
  await withServer({ enabled: true, getView: async () => view(), canShowPublicObject: async () => { throw Error('private'); } }, async base => {
    const response = await fetch(`${base}/v1/public-feed`);
    assert.equal(response.status, 503);
    assert.equal(JSON.stringify(await response.json()).includes('private'), false);
  });
});
