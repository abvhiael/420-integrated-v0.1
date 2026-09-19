import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectBundlerProvider, sendBundlerUserOperation, readBundlerUserOperationReceipt,
  serializeBundlerUserOperation, validateBundlerEndpoints,
} from '../core/bundler-transport.js';

const ep = '0x1111111111111111111111111111111111111111';
const hash = `0x${'ab'.repeat(32)}`;
const tx = `0x${'cd'.repeat(32)}`;
const block = `0x${'ef'.repeat(32)}`;
const op = {
  sender: '0x2222222222222222222222222222222222222222', nonce: 1n,
  initCode: '0x', callData: '0x1234', accountGasLimits: `0x${'33'.repeat(32)}`,
  preVerificationGas: 21000n, gasFees: `0x${'44'.repeat(32)}`,
  paymasterAndData: '0x', signature: '0xaabb',
};

function response(result) { return { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result }) }; }

test('canonical signed operation serialization and endpoint rules', () => {
  const signed = serializeBundlerUserOperation(op);
  assert.equal(signed.nonce, '0x1');
  assert.equal(signed.preVerificationGas, '0x5208');
  assert.equal(signed.signature, '0xaabb');
  assert.throws(() => serializeBundlerUserOperation({ ...op, signature: '0x' }), /signed/);
  assert.throws(() => validateBundlerEndpoints(['http://public.example/rpc']), /HTTPS/);
  assert.throws(() => validateBundlerEndpoints(['https://a.example/rpc', 'https://a.example/rpc']), /duplicate/);
});

test('selects second operator when first is unavailable before submission', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    const request = JSON.parse(init.body);
    calls.push({ url, method: request.method });
    if (url.startsWith('https://one.')) throw new Error('operator down');
    if (request.method === 'eth_supportedEntryPoints') return response([ep]);
    if (request.method === 'eth_sendUserOperation') return response(hash);
    if (request.method === 'eth_getUserOperationReceipt') return response(null);
    throw new Error('unexpected method');
  };
  const chosen = await selectBundlerProvider(['https://one.example/rpc', 'https://two.example/rpc'], ep, { fetcher });
  assert.equal(chosen.endpoint, 'https://two.example/rpc');
  const sent = await sendBundlerUserOperation(chosen, op, hash);
  assert.equal(sent.userOpHash, hash);
  assert.equal(sent.transport, 'bundler');
  assert.equal(await readBundlerUserOperationReceipt(chosen, hash), null);
  assert.equal(calls.filter(({ method }) => method === 'eth_sendUserOperation').length, 1);
});

test('does not retry ambiguous accepted send or accept incorrect returned hash', async () => {
  let sends = 0;
  const fetcher = async (_url, init) => {
    const method = JSON.parse(init.body).method;
    if (method === 'eth_supportedEntryPoints') return response([ep]);
    sends++;
    throw new Error('connection reset after relay accepted operation');
  };
  const chosen = await selectBundlerProvider(['https://one.example', 'https://two.example'], ep, { fetcher });
  await assert.rejects(() => sendBundlerUserOperation(chosen, op, hash), /connection reset/);
  assert.equal(sends, 1);
  const bad = { ...chosen, fetcher: async () => response(tx) };
  await assert.rejects(() => sendBundlerUserOperation(bad, op, hash), /different canonical/);
});

test('receipt requires matched operational inclusion evidence', async () => {
  const selected = { endpoint: 'https://one.example/', entryPoint: ep, timeoutMs: 5000, fetcher: async () => response({
    userOpHash: hash, transactionHash: tx, entryPoint: ep, blockHash: block,
    blockNumber: '0x1', lifecycle: 'included', success: false,
  }) };
  const receipt = await readBundlerUserOperationReceipt(selected, hash);
  assert.equal(receipt.success, false);
  assert.equal(receipt.transactionHash, tx);
  selected.fetcher = async () => response({ ...receipt, userOpHash: tx });
  await assert.rejects(() => readBundlerUserOperationReceipt(selected, hash), /mismatched/);
});
