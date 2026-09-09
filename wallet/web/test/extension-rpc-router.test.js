import assert from 'node:assert/strict';
import test from 'node:test';
import { createExtensionRpcRouter420 } from '../core/extension-rpc-router.js';

function message(method, { origin = 'https://dapp.example', id = '420-1', params = [] } = {}) {
  return {
    source: '420-wallet-content',
    channel: '420-wallet-provider-v1',
    kind: 'rpc',
    origin,
    request: { id, method, params },
  };
}

function sender({ url = 'https://dapp.example/app', frameId = 0, tabId = 7 } = {}) {
  return { url, frameId, tab: { id: tabId, url } };
}

test('routes allowlisted read RPC directly with origin-bound context', async () => {
  const calls = [];
  const router = createExtensionRpcRouter420({
    rpcRequest: async (method, params, context) => {
      calls.push({ method, params, context });
      return '0x1a4';
    },
    requestApproval: async () => { throw new Error('approval should not run'); },
  });

  const response = await router(message('eth_chainId'), sender());
  assert.deepEqual(response, { id: '420-1', result: '0x1a4' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].context.origin, 'https://dapp.example');
  assert.equal(calls[0].context.tabId, 7);
  assert.equal(calls[0].context.frameId, 0);
});

test('routes privileged wallet methods only through approval boundary', async () => {
  const approvals = [];
  const router = createExtensionRpcRouter420({
    rpcRequest: async () => { throw new Error('read RPC should not run'); },
    requestApproval: async (request, context) => {
      approvals.push({ request, context });
      return '0xapproved';
    },
  });

  const response = await router(message('eth_sendTransaction', { params: [{ to: '0x0000000000000000000000000000000000000420' }] }), sender());
  assert.equal(response.result, '0xapproved');
  assert.equal(approvals.length, 1);
  assert.equal(approvals[0].request.method, 'eth_sendTransaction');
  assert.equal(approvals[0].context.origin, 'https://dapp.example');
});

test('eth_accounts uses passive approval/permission boundary rather than public RPC', async () => {
  let approvalContext;
  const router = createExtensionRpcRouter420({
    rpcRequest: async () => { throw new Error('public RPC must not expose accounts'); },
    requestApproval: async (request, context) => {
      approvalContext = context;
      assert.equal(request.method, 'eth_accounts');
      return [];
    },
  });

  const response = await router(message('eth_accounts'), sender());
  assert.deepEqual(response.result, []);
  assert.equal(approvalContext.passive, true);
});

test('rejects claimed origin that does not match extension sender URL', async () => {
  const router = createExtensionRpcRouter420({
    rpcRequest: async () => 'should-not-run',
    requestApproval: async () => 'should-not-run',
  });

  const response = await router(message('eth_chainId', { origin: 'https://evil.example' }), sender());
  assert.equal(response.error.code, 4100);
  assert.match(response.error.message, /origin/i);
});

test('rejects subframe provider RPC even when the claimed origin matches', async () => {
  const router = createExtensionRpcRouter420({
    rpcRequest: async () => 'should-not-run',
    requestApproval: async () => 'should-not-run',
  });

  const response = await router(message('eth_chainId'), sender({ frameId: 3 }));
  assert.equal(response.error.code, 4100);
  assert.match(response.error.message, /subframe/i);
});

test('rejects unsupported provider methods with EIP-1193 code 4200', async () => {
  const router = createExtensionRpcRouter420({
    rpcRequest: async () => 'should-not-run',
    requestApproval: async () => 'should-not-run',
  });

  const response = await router(message('wallet_exportPrivateKey'), sender());
  assert.equal(response.error.code, 4200);
});

test('rejects insecure non-localhost origins before method dispatch', async () => {
  const router = createExtensionRpcRouter420({
    rpcRequest: async () => 'should-not-run',
    requestApproval: async () => 'should-not-run',
  });

  const response = await router(message('eth_chainId', { origin: 'http://dapp.example' }), sender({ url: 'http://dapp.example/app' }));
  assert.equal(response.error.code, 4100);
  assert.match(response.error.message, /insecure/i);
});
