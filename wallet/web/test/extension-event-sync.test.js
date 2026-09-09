import assert from 'node:assert/strict';
import test from 'node:test';
import { ExtensionProviderEventSync420 } from '../core/extension-event-sync.js';

class FakeTabs {
  constructor() { this.sent = []; }
  async sendMessage(tabId, message) { this.sent.push({ tabId, message }); }
}

class FakePermissions {
  constructor(entries = {}) { this.entries = entries; }
  async accountsFor(origin) { return this.entries[origin] ?? []; }
}

test('accountsChanged only reaches tabs tracked to the affected origin', async () => {
  const tabs = new FakeTabs();
  const permissions = new FakePermissions({
    'https://dapp.example': ['0x0000000000000000000000000000000000000420'],
  });
  const sync = new ExtensionProviderEventSync420({ tabs, permissionStore: permissions });
  sync.trackTab(1, 'https://dapp.example/page');
  sync.trackTab(2, 'https://other.example');

  const accounts = await sync.emitAccountsChanged('https://dapp.example');
  assert.deepEqual(accounts, ['0x0000000000000000000000000000000000000420']);
  assert.equal(tabs.sent.length, 1);
  assert.equal(tabs.sent[0].tabId, 1);
  assert.equal(tabs.sent[0].message.event, 'accountsChanged');
});

test('revoked origin emits an empty accountsChanged list', async () => {
  const tabs = new FakeTabs();
  const sync = new ExtensionProviderEventSync420({ tabs, permissionStore: new FakePermissions() });
  sync.trackTab(7, 'https://dapp.example');
  await sync.emitAccountsChanged('https://dapp.example');
  assert.deepEqual(tabs.sent[0].message.data, []);
});

test('chainChanged broadcasts once to all tracked tabs and suppresses duplicates', async () => {
  const tabs = new FakeTabs();
  const sync = new ExtensionProviderEventSync420({ tabs, permissionStore: new FakePermissions() });
  sync.trackTab(1, 'https://a.example');
  sync.trackTab(2, 'https://b.example');

  assert.equal(await sync.emitChainChanged('0x1A4'), true);
  assert.equal(await sync.emitChainChanged('0x1a4'), false);
  assert.equal(tabs.sent.length, 2);
  assert.ok(tabs.sent.every(({ message }) => message.event === 'chainChanged' && message.data === '0x1a4'));
});

test('untracked tabs stop receiving synchronized events', async () => {
  const tabs = new FakeTabs();
  const sync = new ExtensionProviderEventSync420({ tabs, permissionStore: new FakePermissions() });
  sync.trackTab(1, 'https://a.example');
  sync.untrackTab(1);
  await sync.emitChainChanged('0x420');
  assert.equal(tabs.sent.length, 0);
});
