import test from 'node:test';
import assert from 'node:assert/strict';
import { composeMobileScreen420 } from '../core/native-screen-model.js';

test('locked screen only exposes unlock when ready', () => {
  const preparing = composeMobileScreen420({ locked: true, accountReady: false, networkReady: true, view: 'wallet' });
  assert.equal(preparing.actions.length, 0);
  const ready = composeMobileScreen420({ locked: true, accountReady: true, networkReady: true, view: 'wallet' });
  assert.equal(ready.actions[0].id, 'unlock');
});

test('wallet screen composes balances, assets and activity as presentation data', () => {
  const wallet = composeMobileScreen420({ locked: false, view: 'wallet' }, {
    accountLabel: 'Primary',
    totalValue: '420.00',
    assets: [{ symbol: '420', name: '420 Token', balance: '42', fiatValue: '420.00' }],
    activityCount: 3,
  });
  assert.equal(wallet.subtitle, 'Primary');
  assert.equal(wallet.sections[0].assets[0].symbol, '420');
  assert.equal(wallet.sections[1].count, 3);
});

test('apps screen only exposes normalized https application destinations', () => {
  const apps = composeMobileScreen420({ locked: false, view: 'apps' }, {
    apps: [
      { id: '420swap', name: '420 Swap', url: 'https://swap.example', category: 'defi' },
      { id: 'bad', name: 'Bad', url: 'http://bad.example', category: 'unknown' },
    ],
  });
  assert.equal(apps.sections[0].apps[0].url, 'https://swap.example/');
  assert.equal(apps.sections[0].apps[1].url, null);
});

test('activity screen presents UserOperation status without creating signing authority', () => {
  const activity = composeMobileScreen420({ locked: false, view: 'activity' }, {
    activityCount: 1,
    activity: [{ id: 'u1', status: 'included', chainId: '0x420', hash: '0xabc' }],
  });
  assert.equal(activity.sections[0].items[0].status, 'included');
  assert.equal(activity.sections[0].items[0].chainId, '0x420');
});

test('security center composes passkey, session, permission, recovery and device status', () => {
  const security = composeMobileScreen420({ locked: false, view: 'security' }, {
    passkeyCount: 2,
    sessionCount: 3,
    permissionCount: 4,
    passkeyStatus: 'ready',
    sessionStatus: 'healthy',
    recoveryStatus: 'configured',
    deviceStatus: 'secure',
  });
  assert.equal(security.sections.length, 5);
  assert.deepEqual(security.sections.map((section) => section.id), ['passkeys', 'sessions', 'permissions', 'recovery', 'device']);
  assert.deepEqual(security.actions.map((action) => action.id), ['manage-passkeys', 'manage-sessions', 'manage-permissions', 'manage-recovery']);
});

test('approval screen preserves pending request count', () => {
  const approvals = composeMobileScreen420({ locked: false, view: 'approvals', pendingApprovals: 2 });
  assert.equal(approvals.sections[0].count, 2);
});
