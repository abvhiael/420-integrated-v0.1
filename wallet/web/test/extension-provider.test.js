import assert from 'node:assert/strict';
import test from 'node:test';
import { ExtensionProvider420, installExtensionProvider420 } from '../core/extension-provider.js';

class FakeWindow {
  constructor(origin = 'https://dapp.example') {
    this.location = { origin };
    this.listeners = new Map();
    this.sent = [];
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.listeners.get(name)?.delete(listener);
  }

  postMessage(message, targetOrigin) {
    this.sent.push({ message, targetOrigin });
  }

  emitMessage(data, { origin = this.location.origin, source = this } = {}) {
    for (const listener of this.listeners.get('message') ?? []) {
      listener({ data, origin, source });
    }
  }
}

function responseFor(request, overrides = {}) {
  return {
    source: '420-wallet-extension',
    channel: '420-wallet-provider-v1',
    kind: 'response',
    id: request.id,
    result: '0x420',
    ...overrides,
  };
}

test('routes EIP-1193 request over the isolated page bridge', async () => {
  const windowObject = new FakeWindow();
  const provider = new ExtensionProvider420({ windowObject });
  const pending = provider.request({ method: 'eth_chainId' });
  assert.equal(windowObject.sent.length, 1);
  const { message, targetOrigin } = windowObject.sent[0];
  assert.equal(targetOrigin, 'https://dapp.example');
  assert.equal(message.source, '420-wallet-inpage');
  assert.equal(message.kind, 'request');
  assert.equal(message.method, 'eth_chainId');
  assert.deepEqual(message.params, []);
  windowObject.emitMessage(responseFor(message));
  assert.equal(await pending, '0x420');
  provider.destroy();
});

test('ignores forged response origins and channels', async () => {
  const windowObject = new FakeWindow();
  const provider = new ExtensionProvider420({ windowObject, timeoutMs: 50 });
  const pending = provider.request({ method: 'eth_accounts' });
  const request = windowObject.sent[0].message;

  windowObject.emitMessage(responseFor(request), { origin: 'https://evil.example' });
  windowObject.emitMessage(responseFor(request, { channel: 'other-wallet' }));
  assert.equal(provider.pending.size, 1);

  windowObject.emitMessage(responseFor(request, { result: ['0x0000000000000000000000000000000000000420'] }));
  assert.deepEqual(await pending, ['0x0000000000000000000000000000000000000420']);
  provider.destroy();
});

test('preserves EIP-1193 error code and data', async () => {
  const windowObject = new FakeWindow();
  const provider = new ExtensionProvider420({ windowObject });
  const pending = provider.request({ method: 'eth_requestAccounts' });
  const request = windowObject.sent[0].message;
  windowObject.emitMessage(responseFor(request, {
    result: undefined,
    error: { code: 4001, message: 'User rejected the request', data: { reason: 'rejected' } },
  }));
  await assert.rejects(pending, (error) => {
    assert.equal(error.code, 4001);
    assert.equal(error.message, 'User rejected the request');
    assert.deepEqual(error.data, { reason: 'rejected' });
    return true;
  });
  provider.destroy();
});

test('emits only approved EIP-1193 provider events', () => {
  const windowObject = new FakeWindow();
  const provider = new ExtensionProvider420({ windowObject });
  const seen = [];
  provider.on('chainChanged', (chainId) => seen.push(chainId));
  windowObject.emitMessage({
    source: '420-wallet-extension',
    channel: '420-wallet-provider-v1',
    kind: 'event',
    event: 'chainChanged',
    data: '0x1a4',
  });
  windowObject.emitMessage({
    source: '420-wallet-extension',
    channel: '420-wallet-provider-v1',
    kind: 'event',
    event: 'privilegedInternalEvent',
    data: 'should-not-escape',
  });
  assert.deepEqual(seen, ['0x1a4']);
  provider.destroy();
});

test('times out and clears orphaned requests', async () => {
  const windowObject = new FakeWindow();
  const provider = new ExtensionProvider420({ windowObject, timeoutMs: 5 });
  await assert.rejects(provider.request({ method: 'eth_blockNumber' }), (error) => error.code === 4900);
  assert.equal(provider.pending.size, 0);
  provider.destroy();
});

test('installExtensionProvider420 publishes a single 420 provider instance', () => {
  const windowObject = new FakeWindow();
  const first = installExtensionProvider420({ windowObject });
  const second = installExtensionProvider420({ windowObject });
  assert.equal(first, second);
  assert.equal(windowObject.ethereum, first);
  assert.equal(first.is420Wallet, true);
  first.destroy();
});
