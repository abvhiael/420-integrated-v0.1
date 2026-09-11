import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RPC2_METHODS_420,
  classifyRpcMethod420,
  methodsForProfile420,
  upstreamSupportsMethod420,
  validateRpc2MethodProfile420,
} from '../src/methods.js';
import type { RpcUpstreamDiscovery420 } from '../src/upstreams.js';

const execution: RpcUpstreamDiscovery420 = {
  id: 'node420-primary',
  class: 'execution-rpc',
  reachable: true,
  eligible: true,
  expectedChainId: 420n,
  observedChainId: 420n,
  capabilities: ['chain-identity', 'client-version', 'head-read', 'safe-read', 'finalized-read', 'transaction-submission', 'subscriptions'],
  clientVersion: 'node420/test',
  reasons: [],
};

test('RPC-2 compatibility profile validates without invariant violations', () => {
  assert.deepEqual(validateRpc2MethodProfile420(), []);
  assert.ok(RPC2_METHODS_420.length > 20);
});

test('supports canonical read, metadata and raw signed transaction methods', () => {
  assert.equal(classifyRpcMethod420('eth_chainId').supported, true);
  assert.equal(classifyRpcMethod420('eth_getBlockByNumber').supported, true);
  assert.equal(classifyRpcMethod420('eth_call').supported, true);
  const raw = classifyRpcMethod420('eth_sendRawTransaction');
  assert.equal(raw.supported, true);
  assert.equal(raw.definition?.profile, 'submit');
  assert.equal(raw.definition?.requiresUserSignature, true);
});

test('fails closed for account-managed signing and privileged node namespaces', () => {
  for (const method of ['eth_sendTransaction', 'eth_sign', 'eth_accounts', 'personal_sign', 'engine_newPayloadV3', 'admin_peers', 'debug_traceTransaction', 'miner_start', 'txpool_content']) {
    assert.equal(classifyRpcMethod420(method).supported, false, method);
  }
});

test('unknown methods are not silently proxied', () => {
  const decision = classifyRpcMethod420('eth_madeUpMethod');
  assert.equal(decision.supported, false);
  assert.match(decision.reason ?? '', /not in the RPC-2 compatibility profile/);
});

test('subscriptions are websocket-only in the compatibility contract', () => {
  const subscriptions = methodsForProfile420('subscription');
  assert.deepEqual(subscriptions.map((entry) => entry.method), ['eth_subscribe', 'eth_unsubscribe']);
  assert.ok(subscriptions.every((entry) => entry.transport === 'websocket'));
});

test('method eligibility is constrained by discovered upstream capabilities', () => {
  assert.equal(upstreamSupportsMethod420(execution, 'eth_getBalance').supported, true);
  assert.equal(upstreamSupportsMethod420(execution, 'eth_sendRawTransaction').supported, true);

  const readOnly = { ...execution, capabilities: ['chain-identity', 'head-read'] as const };
  const submit = upstreamSupportsMethod420(readOnly, 'eth_sendRawTransaction');
  assert.equal(submit.supported, false);
  assert.match(submit.reason ?? '', /transaction-submission/);

  const noSubscriptions = upstreamSupportsMethod420(readOnly, 'eth_subscribe');
  assert.equal(noSubscriptions.supported, false);
  assert.match(noSubscriptions.reason ?? '', /subscriptions/);
});

test('non-execution and ineligible upstreams cannot satisfy Ethereum method profiles', () => {
  const indexer: RpcUpstreamDiscovery420 = {
    ...execution,
    id: '420indexer-primary',
    class: 'indexer-api',
    capabilities: ['chain-identity', 'derived-read'],
    clientVersion: null,
  };
  assert.equal(upstreamSupportsMethod420(indexer, 'eth_getLogs').supported, false);

  const ineligible = { ...execution, eligible: false, reasons: ['wrong chain'] };
  assert.equal(upstreamSupportsMethod420(ineligible, 'eth_blockNumber').supported, false);
});
