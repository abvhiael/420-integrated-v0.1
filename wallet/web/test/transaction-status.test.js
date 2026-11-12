import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForCanonicalTransaction420 } from '../core/transaction-status.js';

const txHash = `0x${'ab'.repeat(32)}`;
const blockHash = `0x${'cd'.repeat(32)}`;
const otherHash = `0x${'ef'.repeat(32)}`;
const receipt = { status: '0x1', transactionHash: txHash, blockNumber: '0x10', blockHash };

function rpc(overrides = {}) {
  const methods = [];
  const provider = { request: async (method) => {
    methods.push(method);
    if (Object.hasOwn(overrides, method)) {
      const handler = overrides[method];
      return typeof handler === 'function' ? handler() : handler;
    }
    if (method === 'eth_getTransactionReceipt') return receipt;
    if (method === 'eth_getBlockByNumber') return { hash: blockHash };
    if (method === 'eth_blockNumber') return '0x10';
    throw new Error(method);
  }};
  return { provider, methods };
}

test('canonical receipt with matching tx/block and one confirmation succeeds', async () => {
  const { provider, methods } = rpc();
  const result = await waitForCanonicalTransaction420(provider, txHash, { attempts: 1 });
  assert.equal(result.confirmations, 1n);
  assert.equal(result.receipt.transactionHash, txHash);
  assert.deepEqual(methods, ['eth_getTransactionReceipt', 'eth_getBlockByNumber', 'eth_blockNumber', 'eth_getTransactionReceipt']);
});

test('confirmation depth is enforced rather than treating a mined receipt as final', async () => {
  await assert.rejects(waitForCanonicalTransaction420(rpc().provider, txHash, { attempts: 2, delayMs: 0, confirmations: 2 }), /insufficiently deep/);
  const { provider } = rpc({ eth_blockNumber: '0x11' });
  assert.equal((await waitForCanonicalTransaction420(provider, txHash, { attempts: 1, confirmations: 2 })).confirmations, 2n);
});

test('wrong block hash, missing canonical block and receipt disappearing after lookup fail closed', async () => {
  await assert.rejects(waitForCanonicalTransaction420(rpc({ eth_getBlockByNumber: { hash: otherHash } }).provider, txHash, { attempts: 1 }), /reorganization/);
  await assert.rejects(waitForCanonicalTransaction420(rpc({ eth_getBlockByNumber: null }).provider, txHash, { attempts: 1 }), /reorganization/);
  let count = 0;
  await assert.rejects(waitForCanonicalTransaction420(rpc({ eth_getTransactionReceipt: () => (++count === 1 ? receipt : null) }).provider, txHash, { attempts: 1 }), /reorganization/);
});

test('reorged receipt recovers if a canonical replacement appears', async () => {
  let count = 0;
  const { provider } = rpc({ eth_getBlockByNumber: () => ({ hash: ++count === 1 ? otherHash : blockHash }) });
  assert.equal((await waitForCanonicalTransaction420(provider, txHash, { attempts: 2, delayMs: 0 })).blockHash, blockHash);
});

test('pending, reverted, mismatched, malformed and missing block receipts never qualify', async () => {
  await assert.rejects(waitForCanonicalTransaction420(rpc({ eth_getTransactionReceipt: null }).provider, txHash, { attempts: 1 }), /pending or dropped/);
  await assert.rejects(waitForCanonicalTransaction420(rpc({ eth_getTransactionReceipt: { ...receipt, status: '0x0' } }).provider, txHash, { attempts: 1 }), /reverted/);
  await assert.rejects(waitForCanonicalTransaction420(rpc({ eth_getTransactionReceipt: { ...receipt, transactionHash: otherHash } }).provider, txHash, { attempts: 1 }), /hash mismatch/);
  await assert.rejects(waitForCanonicalTransaction420(rpc({ eth_getTransactionReceipt: { status: '0x1', transactionHash: txHash } }).provider, txHash, { attempts: 1 }), /block number/);
});

test('cancellation and invalid polling parameters fail closed', async () => {
  await assert.rejects(waitForCanonicalTransaction420(rpc().provider, txHash, { signal: { aborted: true } }), /cancelled/);
  await assert.rejects(waitForCanonicalTransaction420(rpc().provider, txHash, { confirmations: 0 }), /invalid transaction confirmation depth/);
  await assert.rejects(waitForCanonicalTransaction420(rpc().provider, txHash, { attempts: 0 }), /invalid transaction confirmation attempts/);
});
