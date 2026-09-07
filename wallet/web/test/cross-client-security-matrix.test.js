import test from 'node:test';
import assert from 'node:assert/strict';

import { createExtensionRpcRouter420 } from '../core/extension-rpc-router.js';
import {
  classifyProviderMethod420,
  assertKnownWalletAuthority420,
} from '../core/signing-policy.js';
import {
  createDappPermission420,
  assertDappPermissionActive420,
} from '../core/dapp-permissions.js';
import {
  createMobileDappConnection420,
} from '../../mobile/core/dapp-connection.js';

const ORIGIN_A = 'https://a.example';
const ORIGIN_B = 'https://b.example';
const ACCOUNT_A = '0x1111111111111111111111111111111111111111';
const ACCOUNT_B = '0x2222222222222222222222222222222222222222';
const TARGET = '0x3333333333333333333333333333333333333333';

function extensionEnvelope(method, params = [], origin = ORIGIN_A) {
  return {
    source: '420-wallet-content',
    channel: '420-wallet-provider-v1',
    kind: 'rpc',
    origin,
    request: { id: `req-${method}`, method, params },
  };
}

function extensionSender(origin = ORIGIN_A) {
  return { url: `${origin}/page`, tab: { id: 42, url: `${origin}/page` }, frameId: 0 };
}

function privilegedParams(method) {
  if (method === 'eth_sendTransaction') return [{ from: ACCOUNT_A, to: TARGET, value: '0x0' }];
  if (method === 'personal_sign') return ['0x1234', ACCOUNT_A];
  return [ACCOUNT_A, JSON.stringify({ domain: { chainId: '0x420', verifyingContract: TARGET }, primaryType: 'Message', types: {}, message: {} })];
}

test('W10.5 matrix: one origin permission cannot authorize another origin, account, chain, or expired session', () => {
  const permission = createDappPermission420({
    origin: ORIGIN_A,
    accounts: [ACCOUNT_A],
    chainId: '0x420',
    sessionScopes: ['swap:execute'],
    grantedAt: 1000,
    lastUsedAt: 1000,
    expiresAt: 5000,
  });

  assert.doesNotThrow(() => assertDappPermissionActive420(permission, {
    origin: ORIGIN_A,
    account: ACCOUNT_A,
    chainId: '0x420',
    nowMs: 2000,
  }));
  assert.throws(() => assertDappPermissionActive420(permission, { origin: ORIGIN_B, nowMs: 2000 }), /origin mismatch/);
  assert.throws(() => assertDappPermissionActive420(permission, { account: ACCOUNT_B, nowMs: 2000 }), /not permitted/);
  assert.throws(() => assertDappPermissionActive420(permission, { chainId: '0x421', nowMs: 2000 }), /network mismatch/);
  assert.throws(() => assertDappPermissionActive420(permission, { nowMs: 5000 }), /expired/);
});

test('W10.5 matrix: Extension and Mobile route privileged methods to approval, never public signing RPC', async () => {
  for (const method of ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData_v4']) {
    assert.notEqual(classifyProviderMethod420(method), 'read-only');
    const params = privilegedParams(method);

    const extensionCalls = [];
    const extension = createExtensionRpcRouter420({
      rpcRequest: async (rpcMethod) => { extensionCalls.push(['rpc', rpcMethod]); return null; },
      requestApproval: async (request, context) => { extensionCalls.push(['approval', request.method, context.origin]); return 'approved'; },
    });
    const extensionResult = await extension(extensionEnvelope(method, params), extensionSender());
    assert.equal(extensionResult.result, 'approved');
    assert.deepEqual(extensionCalls, [['approval', method, ORIGIN_A]]);

    const mobileCalls = [];
    const mobile = createMobileDappConnection420({
      rpcRequest: async (rpcMethod) => {
        mobileCalls.push(['rpc', rpcMethod]);
        if (rpcMethod === 'eth_chainId') return '0x420';
        throw new Error(`unexpected public RPC method: ${rpcMethod}`);
      },
      requestApproval: async (request, context) => { mobileCalls.push(['approval', request.method, context.origin]); return 'approved'; },
      accountsFor: async () => [ACCOUNT_A],
    });
    const mobileResult = await mobile.handle({ id: `mobile-${method}`, origin: ORIGIN_A, method, params }, ORIGIN_A);
    assert.equal(mobileResult, 'approved');
    assert.deepEqual(mobileCalls, [
      ['rpc', 'eth_chainId'],
      ['approval', method, ORIGIN_A],
    ]);
    assert.equal(mobileCalls.some(([kind, rpcMethod]) => kind === 'rpc' && rpcMethod === method), false);
  }
});

test('W10.5 matrix: read-only provider methods remain transport-only in both clients', async () => {
  for (const method of ['eth_chainId', 'eth_call', 'eth_getBalance']) {
    assert.equal(classifyProviderMethod420(method), 'read-only');

    const extensionCalls = [];
    const extension = createExtensionRpcRouter420({
      rpcRequest: async (rpcMethod) => { extensionCalls.push(rpcMethod); return '0x420'; },
      requestApproval: async () => { throw new Error('approval must not run for read-only RPC'); },
    });
    assert.equal((await extension(extensionEnvelope(method), extensionSender())).result, '0x420');
    assert.deepEqual(extensionCalls, [method]);

    const mobileCalls = [];
    const mobile = createMobileDappConnection420({
      rpcRequest: async (rpcMethod) => { mobileCalls.push(rpcMethod); return '0x420'; },
      requestApproval: async () => { throw new Error('approval must not run for read-only RPC'); },
      accountsFor: async () => [ACCOUNT_A],
    });
    assert.equal(await mobile.handle({ id: `mobile-${method}`, origin: ORIGIN_A, method, params: [] }, ORIGIN_A), '0x420');
    assert.deepEqual(mobileCalls, [method]);
  }
});

test('W10.5 matrix: unsupported provider actions fail closed with 4200 in policy, Extension, and Mobile', async () => {
  assert.throws(() => assertKnownWalletAuthority420({ method: 'eth_sign' }), (error) => error.code === 4200);

  const extension = createExtensionRpcRouter420({
    rpcRequest: async () => null,
    requestApproval: async () => null,
  });
  const extensionResult = await extension(extensionEnvelope('eth_sign'), extensionSender());
  assert.equal(extensionResult.error?.code, 4200);

  const mobile = createMobileDappConnection420({
    rpcRequest: async () => null,
    requestApproval: async () => null,
    accountsFor: async () => [ACCOUNT_A],
  });
  await assert.rejects(
    mobile.handle({ id: 'mobile-unsupported', origin: ORIGIN_A, method: 'eth_sign', params: [] }, ORIGIN_A),
    (error) => error.code === 4200,
  );
});

test('W10.5 matrix: hostile or mismatched origins fail before any authority or transport handler executes', async () => {
  const extensionCalls = [];
  const extension = createExtensionRpcRouter420({
    rpcRequest: async () => { extensionCalls.push('rpc'); return null; },
    requestApproval: async () => { extensionCalls.push('approval'); return null; },
  });
  const forged = await extension(extensionEnvelope('eth_sendTransaction', privilegedParams('eth_sendTransaction'), ORIGIN_A), extensionSender(ORIGIN_B));
  assert.equal(forged.error?.code, 4100);
  assert.deepEqual(extensionCalls, []);

  const mobileCalls = [];
  const mobile = createMobileDappConnection420({
    rpcRequest: async () => { mobileCalls.push('rpc'); return null; },
    requestApproval: async () => { mobileCalls.push('approval'); return null; },
    accountsFor: async () => [ACCOUNT_A],
  });
  await assert.rejects(
    mobile.handle({ id: 'mobile-origin-drift', origin: ORIGIN_A, method: 'eth_sendTransaction', params: privilegedParams('eth_sendTransaction') }, ORIGIN_B),
    (error) => error.code === 4100,
  );
  assert.deepEqual(mobileCalls, []);
});
