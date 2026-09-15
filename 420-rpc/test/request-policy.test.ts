import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRpcBatchEnvelope420, validateRpcRequest420 } from '../src/request-policy.js';

test('accepts a canonical supported request', () => {
  const decision = validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: ['0x1111111111111111111111111111111111111111', 'latest'] });
  assert.equal(decision.allowed, true);
  assert.equal(decision.profile, 'read');
  assert.equal(decision.code, null);
});

test('rejects malformed JSON-RPC envelopes before method routing', () => {
  assert.equal(validateRpcRequest420(null).code, -32600);
  assert.equal(validateRpcRequest420({ jsonrpc: '1.0', id: 1, method: 'eth_chainId' }).code, -32600);
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: {}, method: 'eth_chainId' }).code, -32600);
});

test('notifications fail closed by default', () => {
  const decision = validateRpcRequest420({ jsonrpc: '2.0', method: 'eth_chainId', params: [] });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, -32600);
  assert.match(decision.reason ?? '', /notifications are disabled/);
});

test('privileged and node-managed signing surfaces return method-not-found policy errors', () => {
  for (const method of ['engine_newPayloadV3', 'debug_traceTransaction', 'admin_peers', 'personal_sign', 'eth_sendTransaction', 'eth_sign']) {
    const decision = validateRpcRequest420({ jsonrpc: '2.0', id: 1, method, params: [] });
    assert.equal(decision.allowed, false, method);
    assert.equal(decision.code, -32601, method);
  }
});

test('unknown methods are not transparently proxied', () => {
  const decision = validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_magic420', params: [] });
  assert.equal(decision.code, -32601);
});

test('requires positional array params', () => {
  const decision = validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: { address: '0x1111111111111111111111111111111111111111' } });
  assert.equal(decision.code, -32602);
});

test('rejects malformed addresses, hashes, quantities and block selectors', () => {
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: ['0x1234', 'latest'] }).code, -32602);
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: ['0x12'] }).code, -32602);
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_getStorageAt', params: ['0x1111111111111111111111111111111111111111', '0x00', 'latest'] }).code, -32602);
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: ['tomorrow', false] }).code, -32602);
});

test('rejects malformed transaction objects before eth_call or estimateGas reaches an upstream', () => {
  const call = validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: '0x1234', data: '0x' }, 'latest'] });
  assert.equal(call.code, -32602);
  const estimate = validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_estimateGas', params: [{ to: '0x1111111111111111111111111111111111111111', value: '1' }] });
  assert.equal(estimate.code, -32602);
});

test('rejects conflicting getLogs blockHash and range filters', () => {
  const decision = validateRpcRequest420({
    jsonrpc: '2.0', id: 1, method: 'eth_getLogs', params: [{ blockHash: `0x${'11'.repeat(32)}`, fromBlock: 'latest' }],
  });
  assert.equal(decision.code, -32602);
});

test('accepts signed raw transaction bytes but rejects empty or non-byte hex', () => {
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: ['0x0102'] }).allowed, true);
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: ['0x'] }).code, -32602);
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: ['0x1'] }).code, -32602);
});

test('enforces subscription type and filter policy', () => {
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_subscribe', params: ['newHeads'] }).allowed, true);
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_subscribe', params: ['alchemy_pendingTransactions'] }).code, -32602);
  assert.equal(validateRpcRequest420({ jsonrpc: '2.0', id: 1, method: 'eth_subscribe', params: ['newHeads', {}] }).code, -32602);
});

test('validates batch envelopes without imposing RPC-6 resource limits', () => {
  assert.deepEqual(validateRpcBatchEnvelope420([]), ['batch request must not be empty']);
  const errors = validateRpcBatchEnvelope420([
    { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] },
    { jsonrpc: '2.0', id: 2, method: 'debug_traceTransaction', params: [] },
  ]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /batch\[1\]/);
});
