import test from 'node:test';
import assert from 'node:assert/strict';
import { installProviderLifecycle, installFailClosedBrowserLifecycle, shouldReloadForAccounts } from '../core/provider-lifecycle.js';

test('provider lifecycle subscribes and removes supported EIP-1193 handlers', () => {
  const added = [];
  const removed = [];
  const provider = {
    on: (event, handler) => added.push([event, handler]),
    removeListener: (event, handler) => removed.push([event, handler]),
  };
  const handlers = {
    accountsChanged() {},
    chainChanged() {},
    disconnect() {},
  };
  const cleanup = installProviderLifecycle(provider, handlers);
  assert.deepEqual(added.map(([event]) => event), ['accountsChanged', 'chainChanged', 'disconnect']);
  cleanup();
  assert.deepEqual(removed.map(([event]) => event), ['accountsChanged', 'chainChanged', 'disconnect']);
});

test('browser lifecycle reloads on account, chain, and disconnect context changes', () => {
  const listeners = new Map();
  const provider = { on: (event, handler) => listeners.set(event, handler), removeListener() {} };
  let reloads = 0;
  installFailClosedBrowserLifecycle(provider, { reload: () => { reloads += 1; } });
  listeners.get('accountsChanged')(['0x1111111111111111111111111111111111111111']);
  listeners.get('chainChanged')('0x420');
  listeners.get('disconnect')({ code: 4900 });
  assert.equal(reloads, 3);
});

test('account payload validation fails closed', () => {
  assert.equal(shouldReloadForAccounts([]), true);
  assert.equal(shouldReloadForAccounts(['0x1234']), true);
  assert.equal(shouldReloadForAccounts(['0x1111111111111111111111111111111111111111']), false);
});
