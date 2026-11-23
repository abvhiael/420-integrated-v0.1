import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex, IndexerBlock } from '../src/chain-source.js';
import { Node420EngineSource } from '../src/rpc-source.js';

const block: IndexerBlock = {
  number: 2n, hash: `0x${'ab'.repeat(32)}`,
  parentHash: `0x${'ef'.repeat(32)}`, timestamp: 24n, extraData: `0x${'dc'.repeat(32)}`
};
const zero: Hex = `0x${'00'.repeat(32)}`;
const log = {
  address: `0x${'00'.repeat(18)}0420`, blockHash: block.hash, blockNumber: '0x2',
  transactionHash: zero, logIndex: '0x0', transactionIndex: '0x0', topics: [zero],
  data: '0x', removed: false
};
const archive = { blockHash: block.hash, blockNumber: '0x2', batchRoot: block.extraData, logs: [log] };

function source(result: unknown) {
  return new Node420EngineSource({
    async request<T>(method: string, params?: readonly unknown[]): Promise<T> {
      assert.equal(method, 'engine420_getSystemCallLogsV1');
      assert.deepEqual(params, [block.hash]);
      return result as T;
    }
  });
}

test('native settlement archive binds log positions to the canonical execution commitment', async () => {
  const [row] = await source(archive).getNativeLogs(block);
  assert.equal(row.blockHash, block.hash);
  assert.equal(row.blockNumber, 2n);
  assert.equal(row.transactionHash, zero);
  assert.equal(row.logIndex, 0);
});

test('native settlement rejects orphan archives, ordinary transaction claims and duplicate positions', async () => {
  for (const invalid of [
    { ...archive, blockHash: block.parentHash },
    { ...archive, batchRoot: zero },
    { ...archive, logs: [{ ...log, transactionHash: block.hash }] },
    { ...archive, logs: [{ ...log, removed: true }] },
    { ...archive, logs: [log, log] }
  ]) {
    await assert.rejects(source(invalid).getNativeLogs(block), /native (archive|log)/);
  }
});
