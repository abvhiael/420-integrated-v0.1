import assert from 'node:assert/strict';
import test from 'node:test';
import { OriginPermissionStore420 } from '../core/extension-permissions.js';

class MemoryStorage {
  constructor() { this.data = {}; }
  async get(key) { return { [key]: this.data[key] }; }
  async set(value) { Object.assign(this.data, value); }
}

test('grants and reads accounts per exact origin', async () => {
  const storage = new MemoryStorage();
  const store = new OriginPermissionStore420(storage);
  await store.grant('https://app.example/path', ['0x0000000000000000000000000000000000000420']);
  assert.deepEqual(await store.accountsFor('https://app.example'), ['0x0000000000000000000000000000000000000420']);
  assert.deepEqual(await store.accountsFor('https://other.example'), []);
});

test('deduplicates and normalizes granted accounts', async () => {
  const store = new OriginPermissionStore420(new MemoryStorage());
  const accounts = await store.grant('https://app.example', [
    '0x000000000000000000000000000000000000042A',
    '0x000000000000000000000000000000000000042a',
  ]);
  assert.deepEqual(accounts, ['0x000000000000000000000000000000000000042a']);
});

test('rejects insecure non-localhost origins', async () => {
  const store = new OriginPermissionStore420(new MemoryStorage());
  await assert.rejects(store.grant('http://evil.example', ['0x0000000000000000000000000000000000000420']));
});

test('revokes one origin without affecting another', async () => {
  const store = new OriginPermissionStore420(new MemoryStorage());
  await store.grant('https://a.example', ['0x0000000000000000000000000000000000000420']);
  await store.grant('https://b.example', ['0x0000000000000000000000000000000000000421']);
  assert.equal(await store.revoke('https://a.example'), true);
  assert.deepEqual(await store.accountsFor('https://a.example'), []);
  assert.deepEqual(await store.accountsFor('https://b.example'), ['0x0000000000000000000000000000000000000421']);
});
