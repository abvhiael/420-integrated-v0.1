import assert from 'node:assert/strict';
import test from 'node:test';
import { RpcAdmissionController420 } from '../src/resource-controls.js';
import { secureAdmitRpcEnvelope420, inspectRpcJsonStructure420, validateRpcEnvelopeShape420 } from '../src/security.js';
import type { RpcPrincipal420 } from '../src/auth.js';

const readPrincipal: RpcPrincipal420 = {
  kind: 'credential',
  principalId: 'app:test:credential:read-only',
  clientKey: 'credential:read-only',
  applicationId: 'test',
  credentialId: 'read-only',
  scopes: ['rpc:read'],
  authenticated: true,
};

const fullPrincipal: RpcPrincipal420 = {
  kind: 'credential',
  principalId: 'app:test:credential:full',
  clientKey: 'credential:full',
  applicationId: 'test',
  credentialId: 'full',
  scopes: ['rpc:read', 'rpc:submit', 'rpc:subscribe'],
  authenticated: true,
};

function request(method: string, params: unknown[] = []) {
  return { jsonrpc: '2.0' as const, id: 1, method, params };
}

test('rejects prototype-pollution object keys before request handling', () => {
  const envelope = JSON.parse('{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"constructor":{"prototype":{"polluted":true}}},"latest"]}');
  const errors = inspectRpcJsonStructure420(envelope);
  assert(errors.some((error) => error.includes('forbidden object key constructor')));
});

test('rejects excessive JSON depth and node amplification', () => {
  let deep: unknown = 'x';
  for (let i = 0; i < 30; i += 1) deep = [deep];
  assert(inspectRpcJsonStructure420(deep).some((error) => error.includes('maximum JSON depth')));

  const many = Array.from({ length: 5000 }, () => 0);
  assert(inspectRpcJsonStructure420(many).some((error) => error.includes('JSON node count')));
});

test('rejects envelope smuggling keys', () => {
  assert.deepEqual(validateRpcEnvelopeShape420({ ...request('eth_blockNumber'), admin: true }), ['request contains unexpected top-level key admin']);
});

test('authorization rejection occurs before RPC-6 quota state is consumed', () => {
  const controller = new RpcAdmissionController420();
  const before = controller.snapshot(readPrincipal.clientKey);
  const decision = secureAdmitRpcEnvelope420({
    envelope: request('eth_sendRawTransaction', ['0x0102']),
    encodedBytes: 100,
    nowMs: 1000,
    principal: readPrincipal,
    admissionController: controller,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'unauthorized');
  assert.deepEqual(controller.snapshot(readPrincipal.clientKey), before);
});

test('mixed-scope batch fails atomically before admission', () => {
  const controller = new RpcAdmissionController420();
  const decision = secureAdmitRpcEnvelope420({
    envelope: [request('eth_blockNumber'), request('eth_sendRawTransaction', ['0x0102'])],
    encodedBytes: 220,
    nowMs: 1000,
    principal: readPrincipal,
    admissionController: controller,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'unauthorized');
  assert.equal(controller.snapshot().activeLeases, 0);
  assert.equal(controller.snapshot().trackedClients, 0);
});

test('rpc admin scope cannot bypass RPC-5 privileged method exclusions', () => {
  const admin: RpcPrincipal420 = { ...fullPrincipal, scopes: ['rpc:admin'] };
  const controller = new RpcAdmissionController420();
  const decision = secureAdmitRpcEnvelope420({
    envelope: request('engine_forkchoiceUpdatedV3', []),
    encodedBytes: 80,
    nowMs: 1000,
    principal: admin,
    admissionController: controller,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'invalid-request');
  assert.equal(controller.snapshot().trackedClients, 0);
});

test('authorized batch reaches RPC-6 as the authenticated client and releases cleanly', () => {
  const controller = new RpcAdmissionController420();
  const envelope = [request('eth_blockNumber'), request('eth_chainId')];
  const decision = secureAdmitRpcEnvelope420({
    envelope,
    encodedBytes: 180,
    nowMs: 1000,
    principal: fullPrincipal,
    admissionController: controller,
  });
  assert.equal(decision.allowed, true);
  assert.ok(decision.admission?.leaseId);
  assert.equal(controller.snapshot(fullPrincipal.clientKey).client?.concurrentUnits, 2);
  assert.equal(controller.release(decision.admission!.leaseId!, 1010), true);
  assert.equal(controller.snapshot(fullPrincipal.clientKey).client?.concurrentUnits, 0);
});

test('structurally malformed payload cannot allocate RPC-6 client state', () => {
  const controller = new RpcAdmissionController420();
  const decision = secureAdmitRpcEnvelope420({
    envelope: { ...request('eth_blockNumber'), extra: { __proto__: null } },
    encodedBytes: 100,
    nowMs: 1000,
    principal: fullPrincipal,
    admissionController: controller,
  });
  assert.equal(decision.allowed, false);
  assert.equal(controller.snapshot().trackedClients, 0);
});

test('resource rejection is preserved by the security gate', () => {
  const controller = new RpcAdmissionController420({
    maxSingleRequestBytes: 32,
    maxBatchBytes: 64,
    maxBatchEntries: 2,
    maxBatchCost: 10,
    maxConcurrentUnitsPerClient: 2,
    maxConcurrentUnitsGlobal: 2,
    tokenCapacityPerClient: 10,
    tokenRefillPerSecond: 1,
    maxTrackedClients: 10,
    clientIdleTtlMs: 1000,
    maxClientKeyLength: 128,
  });
  const decision = secureAdmitRpcEnvelope420({
    envelope: request('eth_blockNumber'),
    encodedBytes: 33,
    nowMs: 1000,
    principal: fullPrincipal,
    admissionController: controller,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'resource-rejected');
  assert.equal(decision.admission?.reason, 'request-too-large');
});
