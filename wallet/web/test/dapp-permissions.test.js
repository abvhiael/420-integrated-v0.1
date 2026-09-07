import test from 'node:test';
import assert from 'node:assert/strict';
import { createDappPermission420, assertDappPermissionActive420, touchDappPermission420 } from '../core/dapp-permissions.js';

const ACCOUNT = '0x1111111111111111111111111111111111111111';

test('canonical permission binds origin, account, chain, scopes and expiry', () => {
  const permission = createDappPermission420({
    origin: 'https://dapp.example/path',
    accounts: [ACCOUNT],
    chainId: '0x420',
    sessionScopes: ['swap:quote', 'swap:execute', 'swap:quote'],
    grantedAt: 1000,
    lastUsedAt: 1100,
    expiresAt: 5000,
  });
  assert.equal(permission.origin, 'https://dapp.example');
  assert.equal(permission.chainId, '0x420');
  assert.deepEqual(permission.sessionScopes, ['swap:execute', 'swap:quote']);
  assert.equal(assertDappPermissionActive420(permission, { origin: 'https://dapp.example', account: ACCOUNT, chainId: '0x420', nowMs: 1200 }), permission);
});

test('permission fails closed on origin, account, chain and expiry drift', () => {
  const permission = createDappPermission420({ origin: 'https://dapp.example', accounts: [ACCOUNT], chainId: '0x420', grantedAt: 1000, expiresAt: 2000 });
  assert.throws(() => assertDappPermissionActive420(permission, { origin: 'https://evil.example', nowMs: 1500 }), /origin mismatch/);
  assert.throws(() => assertDappPermissionActive420(permission, { account: '0x2222222222222222222222222222222222222222', nowMs: 1500 }), /not permitted/);
  assert.throws(() => assertDappPermissionActive420(permission, { chainId: '0x421', nowMs: 1500 }), /network mismatch/);
  assert.throws(() => assertDappPermissionActive420(permission, { nowMs: 2000 }), /expired/);
});

test('touch only advances last-used metadata', () => {
  const permission = createDappPermission420({ origin: 'https://dapp.example', accounts: [ACCOUNT], grantedAt: 1000, lastUsedAt: 1000 });
  const touched = touchDappPermission420(permission, 1500);
  assert.equal(touched.grantedAt, 1000);
  assert.equal(touched.lastUsedAt, 1500);
  assert.deepEqual(touched.accounts, permission.accounts);
});
