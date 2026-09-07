import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentScriptBridge420 } from '../core/extension-content-bridge.js';

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
  emit(data, { origin = this.location.origin, source = this } = {}) {
    for (const listener of this.listeners.get('message') ?? []) listener({ data, origin, source });
  }
}

class FakeRuntime {
  constructor() {
    this.sent = [];
    this.listeners = new Set();
    this.response = null;
    this.onMessage = {
      addListener: (listener) => this.listeners.add(listener),
      removeListener: (listener) => this.listeners.delete(listener),
    };
  }
  async sendMessage(message) {
    this.sent.push(message);
    if (this.response instanceof Error) throw this.response;
    return this.response;
  }
  emit(message) {
    for (const listener of this.listeners) listener(message);
  }
}

function request(id = '420-1', method = 'eth_chainId') {
  return {
    source: '420-wallet-inpage',
    channel: '420-wallet-provider-v1',
    kind: 'request',
    id,
    method,
    params: [],
  };
}

test('content bridge binds page request to actual page origin before runtime routing', async () => {
  const windowObject = new FakeWindow();
  const runtime = new FakeRuntime();
  runtime.response = { id: '420-1', result: '0x1a4' };
  const bridge = createContentScriptBridge420({ windowObject, runtime });

  windowObject.emit(request());
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(runtime.sent.length, 1);
  assert.equal(runtime.sent[0].origin, 'https://dapp.example');
  assert.equal(runtime.sent[0].source, '420-wallet-content');
  assert.equal(runtime.sent[0].request.method, 'eth_chainId');
  assert.equal(windowObject.sent.at(-1).message.result, '0x1a4');
  assert.equal(windowObject.sent.at(-1).targetOrigin, 'https://dapp.example');
  bridge.destroy();
});

test('content bridge ignores cross-origin, wrong-source, and wrong-channel page messages', async () => {
  const windowObject = new FakeWindow();
  const runtime = new FakeRuntime();
  const bridge = createContentScriptBridge420({ windowObject, runtime });

  windowObject.emit(request(), { origin: 'https://evil.example' });
  windowObject.emit({ ...request(), source: 'other-wallet' });
  windowObject.emit({ ...request(), channel: 'other-channel' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(runtime.sent.length, 0);
  bridge.destroy();
});

test('content bridge rejects mismatched runtime response ids instead of confusing pending requests', async () => {
  const windowObject = new FakeWindow();
  const runtime = new FakeRuntime();
  runtime.response = { id: '420-other', result: '0x1a4' };
  const bridge = createContentScriptBridge420({ windowObject, runtime });

  windowObject.emit(request());
  await new Promise((resolve) => setTimeout(resolve, 0));

  const response = windowObject.sent.at(-1).message;
  assert.equal(response.kind, 'response');
  assert.equal(response.id, '420-1');
  assert.equal(response.error.code, -32603);
  bridge.destroy();
});

test('content bridge forwards only approved service-worker provider events', () => {
  const windowObject = new FakeWindow();
  const runtime = new FakeRuntime();
  const bridge = createContentScriptBridge420({ windowObject, runtime });

  runtime.emit({
    source: '420-wallet-service-worker',
    channel: '420-wallet-provider-v1',
    kind: 'event',
    event: 'accountsChanged',
    data: ['0x0000000000000000000000000000000000000420'],
  });
  runtime.emit({
    source: '420-wallet-service-worker',
    channel: '420-wallet-provider-v1',
    kind: 'event',
    event: 'internalApprovalQueue',
    data: ['secret'],
  });

  assert.equal(windowObject.sent.length, 1);
  assert.equal(windowObject.sent[0].message.event, 'accountsChanged');
  bridge.destroy();
});
