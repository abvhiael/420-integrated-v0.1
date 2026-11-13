import test from 'node:test';
import assert from 'node:assert/strict';
import { ECOSYSTEM_WEBSITES, filterEcosystemWebsites, isApprovedEcosystemWebsite } from '../core/ecosystem-websites.js';
import { GENESIS_APP_SERVICES } from '../core/genesis-app-catalog.js';

const expected = ['420Exchange','BongGoggles','420Travel','20Mail','420TownSquare','420Media','PuffBuddies','DoobTube','420Hz','420Grow','DOOBr','Liftd','420BnB','420Bet'];
test('all requested ecosystem websites have safe exact-domain shortcuts', () => {
  assert.deepEqual(ECOSYSTEM_WEBSITES.map(app => app.name), expected);
  assert.equal(new Set(ECOSYSTEM_WEBSITES.map(app => app.id)).size, expected.length);
  for (const app of ECOSYSTEM_WEBSITES) {
    assert.equal(isApprovedEcosystemWebsite(app), true, app.name);
    assert.equal(app.url, `https://${app.id}.420integrated.org/`);
    assert.equal('serviceId' in app, false, 'website shortcuts must not claim canonical service identity');
  }
});
test('website shortcuts are independent of canonical verified service metadata', () => {
  for (const app of ECOSYSTEM_WEBSITES) assert.equal(GENESIS_APP_SERVICES.includes(app), false);
});
test('website search supports title and categories', () => {
  assert.deepEqual(filterEcosystemWebsites('BET').map(app => app.name), ['420Bet']);
  assert.deepEqual(filterEcosystemWebsites('pelican'), []);
  assert.equal(filterEcosystemWebsites().length, expected.length);
});
test('approved URL guard rejects modified or credential-bearing shortcut records', () => {
  const app = ECOSYSTEM_WEBSITES[0];
  for (const url of ['http://420exchange.420integrated.org/', 'https://evil.example/', 'https://user:password@420exchange.420integrated.org/', 'https://420exchange.420integrated.org/evil', 'javascript:alert(1)']) {
    assert.equal(isApprovedEcosystemWebsite({...app,url}), false);
  }
});
