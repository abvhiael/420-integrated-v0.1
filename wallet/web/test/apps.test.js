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

test('Pay discovery presents the approved catalogue entry without allowing manifest-only launch', async () => {
  const pay = APP_SERVICES.find((app) => app.id === 'pay');
  const candidate = { serviceId: pay.serviceId, name: pay.name, url: pay.proposedOrigin,
    releaseStage: 'production', available: true };
  const responses = [
    { manifest: { url: 'https://manifest.example/apps.json' } },
    { schema: '420-ecosystem-manifest-v1', verified: true, services: [candidate] },
  ];
  const { apps } = await loadVerifiedApps(async () => ({ ok: true, json: async () => responses.shift() }));
  const discovered = filterAppCatalog(apps, { category: 'finance', query: 'pay' });
  const expected = { ...pay, available: false, url: null, verified: false };
  assert.deepEqual(discovered.find((app) => app.id === 'pay'), expected);
  assert.deepEqual(buildAppCatalog([candidate]), [expected]);
  assert.equal(pay.serviceId, '420/service/pay/v1');
  assert.equal(pay.proposedOrigin, 'https://pay.420integrated.org');
  assert.equal(pay.releaseStage, 'approved');
  assert.equal(pay.classification, 'GENESIS_PROTOCOL_AND_USER_APP');
});

test('Token is Wallet-integrated and never gains an external link from a manifest or generic Registry navigation',async()=>{
  const {normalizeGenesisServiceEntry420,discoverGenesisServices420}=await import('../core/genesis-wallet-integration420.js');
  const token=APP_SERVICES.find(app=>app.id==='token');
  assert.equal(token.walletIntegrated,true);
  assert.equal(token.requiresVerifiedRegistry,true);
  const candidate={id:token.id,name:token.name,serviceId:token.serviceId,approved:true,available:true,verified:true,
    origin:'https://fake-token.example',url:'https://fake-token.example/',chainId:'0x1a4',version:1,releaseStage:'testnet'};
  const responses=[{manifest:{url:'https://manifest.example/apps.json'}},
    {schema:'420-ecosystem-manifest-v1',verified:true,services:[candidate]}];
  const {apps}=await loadVerifiedApps(async()=>({ok:true,json:async()=>responses.shift()}));
  const t=apps.find(app=>app.id==='token');
  assert.equal(t.available,false);assert.equal(t.url,null);assert.equal(t.verified,false);
  assert.equal(buildAppCatalog([candidate])[0].url,null);
  assert.throws(()=>normalizeGenesisServiceEntry420(candidate,'0x1a4'),/dedicated runtime discovery/);
  let reads=0;
  const verified=await discoverGenesisServices420({request:async()=>{reads++;throw Error('unexpected RPC')}},
    {registry:{address:'0x'+'11'.repeat(20),codeHash:'0x'+'22'.repeat(32),chainId:'0x1a4',environment:'testnet'},
      services:[candidate],chainId:'0x1a4'});
  assert.deepEqual(verified,[]);
  assert.equal(reads,0);
});
