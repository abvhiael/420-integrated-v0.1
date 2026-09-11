import test from 'node:test';
import assert from 'node:assert/strict';

import { RpcAdmissionController420, DEFAULT_RPC6_RESOURCE_POLICY_420, rpcMethodCost420 } from '../src/resource-controls.js';

function request(method: string, params: unknown[] = [], id = 1) {
  return { jsonrpc: '2.0', id, method, params };
}

test('admits a valid request and accounts/release concurrency', () => {
  const controller = new RpcAdmissionController420();
  const decision = controller.admit({ clientKey: 'client-a', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: 0 });
  assert.equal(decision.allowed, true);
  assert.equal(decision.cost, rpcMethodCost420('eth_blockNumber'));
  assert.equal(decision.concurrencyUnits, 1);
  assert.ok(decision.leaseId);
  assert.equal(controller.snapshot('client-a').globalConcurrentUnits, 1);
  assert.equal(controller.release(decision.leaseId!), true);
  assert.equal(controller.snapshot('client-a').globalConcurrentUnits, 0);
  assert.equal(controller.release(decision.leaseId!), false);
});

test('rejects oversized single requests and oversized batches before admission', () => {
  const controller = new RpcAdmissionController420();
  const single = controller.admit({ clientKey: 'client-a', envelope: request('eth_blockNumber'), encodedBytes: DEFAULT_RPC6_RESOURCE_POLICY_420.maxSingleRequestBytes + 1, nowMs: 0 });
  assert.equal(single.reason, 'request-too-large');

  const batch = Array.from({ length: DEFAULT_RPC6_RESOURCE_POLICY_420.maxBatchEntries + 1 }, (_, i) => request('eth_blockNumber', [], i));
  const batched = controller.admit({ clientKey: 'client-a', envelope: batch, encodedBytes: 1000, nowMs: 0 });
  assert.equal(batched.reason, 'batch-too-large');
});

test('charges expensive methods more heavily and prevents batch quota bypass', () => {
  const controller = new RpcAdmissionController420({ ...DEFAULT_RPC6_RESOURCE_POLICY_420, maxBatchCost: 15 });
  const batch = [
    request('eth_getLogs', [{ fromBlock: 'latest', toBlock: 'latest' }], 1),
    request('eth_sendRawTransaction', ['0x0102'], 2),
  ];
  const decision = controller.admit({ clientKey: 'client-a', envelope: batch, encodedBytes: 400, nowMs: 0 });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'batch-too-expensive');
  assert.equal(decision.cost, 18);
});

test('enforces per-client token bucket and returns deterministic retry guidance', () => {
  const controller = new RpcAdmissionController420({
    ...DEFAULT_RPC6_RESOURCE_POLICY_420,
    tokenCapacityPerClient: 10,
    tokenRefillPerSecond: 2,
  });
  const first = controller.admit({ clientKey: 'client-a', envelope: request('eth_sendRawTransaction', ['0x0102']), encodedBytes: 100, nowMs: 0 });
  assert.equal(first.allowed, true);
  controller.release(first.leaseId!);

  const limited = controller.admit({ clientKey: 'client-a', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: 0 });
  assert.equal(limited.reason, 'rate-limited');
  assert.equal(limited.retryAfterMs, 500);

  const recovered = controller.admit({ clientKey: 'client-a', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: 500 });
  assert.equal(recovered.allowed, true);
});

test('enforces per-client and global concurrency using batch fanout units', () => {
  const controller = new RpcAdmissionController420({
    ...DEFAULT_RPC6_RESOURCE_POLICY_420,
    maxConcurrentUnitsPerClient: 2,
    maxConcurrentUnitsGlobal: 3,
  });
  const a = controller.admit({ clientKey: 'a', envelope: [request('eth_blockNumber', [], 1), request('eth_chainId', [], 2)], encodedBytes: 150, nowMs: 0 });
  assert.equal(a.allowed, true);

  const aBlocked = controller.admit({ clientKey: 'a', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: 0 });
  assert.equal(aBlocked.reason, 'client-concurrency-exhausted');

  const b = controller.admit({ clientKey: 'b', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: 0 });
  assert.equal(b.allowed, true);
  const cBlocked = controller.admit({ clientKey: 'c', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: 0 });
  assert.equal(cBlocked.reason, 'global-concurrency-exhausted');
});

test('RPC-5 policy failures are rejected before any quota is consumed', () => {
  const controller = new RpcAdmissionController420();
  const invalid = controller.admit({ clientKey: 'client-a', envelope: request('engine_forkchoiceUpdatedV3'), encodedBytes: 100, nowMs: 0 });
  assert.equal(invalid.reason, 'invalid-request');
  assert.equal(controller.snapshot('client-a').trackedClients, 0);
});

test('bounded client table evicts idle clients but never active leases', () => {
  const controller = new RpcAdmissionController420({
    ...DEFAULT_RPC6_RESOURCE_POLICY_420,
    maxTrackedClients: 1,
    clientIdleTtlMs: 1000,
  });
  const active = controller.admit({ clientKey: 'a', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: 0 });
  assert.equal(active.allowed, true);
  const blocked = controller.admit({ clientKey: 'b', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: 2000 });
  assert.equal(blocked.reason, 'client-table-exhausted');
  controller.release(active.leaseId!, 2000);
  const admitted = controller.admit({ clientKey: 'b', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: 4000 });
  assert.equal(admitted.allowed, true);
});

test('rejects invalid client keys and invalid accounting inputs', () => {
  const controller = new RpcAdmissionController420();
  assert.equal(controller.admit({ clientKey: '', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: 0 }).reason, 'invalid-client');
  assert.equal(controller.admit({ clientKey: 'a', envelope: request('eth_blockNumber'), encodedBytes: -1, nowMs: 0 }).reason, 'invalid-request');
  assert.equal(controller.admit({ clientKey: 'a', envelope: request('eth_blockNumber'), encodedBytes: 80, nowMs: Number.NaN }).reason, 'invalid-request');
});
