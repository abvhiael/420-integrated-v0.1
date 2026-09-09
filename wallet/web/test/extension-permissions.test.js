import assert from 'node:assert/strict';
import test from 'node:test';
import { OriginPermissionStore420 } from '../core/extension-permissions.js';

class MemoryStorage {
  constructor() { this.data = {}; }
  async get(key) { return { [key]: this.data[key] }; }
  async set(value) { Object.assign(this.data, value); }
}

const ACCOUNT = '0x0000000000000000000000000000000000000420';

test('grants and reads accounts per exact origin', async () => {
  const storage = new MemoryStorage();
  const store = new OriginPermissionStore420(storage);
  await store.grant('https://app.example/path', [ACCOUNT], { chainId: '0x420', sessionScopes: ['swap:execute'], expiresAt: 5000, nowMs: 1000 });
  assert.deepEqual(await store.accountsFor('https://app.example', { chainId: '0x420', nowMs: 2000 }), [ACCOUNT]);
  assert.deepEqual(await store.accountsFor('https://other.example', { nowMs: 2000 }), []);
  const permission = await store.permissionFor('https://app.example', { chainId: '0x420', nowMs: 2000 });
  assert.deepEqual(permission.sessionScopes, ['swap:execute']);
  assert.equal(permission.expiresAt, 5000);
});

test('deduplicates and normalizes granted accounts', async () => {
  const store = new OriginPermissionStore420(new MemoryStorage());
  const accounts = await store.grant('https://app.example', [
    '0x000000000000000000000000000000000000042A',
    '0x000000000000000000000000000000000000042a',
  ], { nowMs: 1000 });
  assert.deepEqual(accounts, ['0x000000000000000000000000000000000000042a']);
});

test('rejects insecure non-localhost origins', async () => {
  const store = new OriginPermissionStore420(new MemoryStorage());
  await assert.rejects(store.grant('http://evil.example', [ACCOUNT], { nowMs: 1000 }));
});

test('network drift and expiry fail closed', async () => {
  const store = new OriginPermissionStore420(new MemoryStorage());
  await store.grant('https://app.example', [ACCOUNT], { chainId: '0x420', expiresAt: 2000, nowMs: 1000 });
  assert.equal(await store.permissionFor('https://app.example', { chainId: '0x421', nowMs: 1500 }), null);
  assert.equal(await store.permissionFor('https://app.example', { chainId: '0x420', nowMs: 2000 }), null);
});

test('touch updates last-used time and revoke removes one origin only', async () => {
  const store = new OriginPermissionStore420(new MemoryStorage());
  await store.grant('https://a.example', [ACCOUNT], { nowMs: 1000 });
  await store.grant('https://b.example', ['0x0000000000000000000000000000000000000421'], { nowMs: 1000 });
  assert.equal(await store.touch('https://a.example', 1500), true);
  assert.equal((await store.permissionFor('https://a.example', { nowMs: 1500 })).lastUsedAt, 1500);
  assert.equal(await store.revoke('https://a.example'), true);
  assert.deepEqual(await store.accountsFor('https://a.example', { nowMs: 1500 }), []);
  assert.deepEqual(await store.accountsFor('https://b.example', { nowMs: 1500 }), ['0x0000000000000000000000000000000000000421']);
});
