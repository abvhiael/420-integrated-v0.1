import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCheckpointContinuation420,
  assertFinalityPolicy420,
  checkpointFromBlock420,
  normalizeLogs420,
  safeHead420,
  type IndexerBlock,
  type IndexerLog
} from '../src/index.js';

const h = (value: string) => value as `0x${string}`;

function block(number: bigint, hash: string, parentHash: string): IndexerBlock {
  return { number, hash: h(hash), parentHash: h(parentHash), timestamp: 1n };
}

function log(overrides: Partial<IndexerLog> = {}): IndexerLog {
  return {
    address: h('0x4200'),
    blockHash: h('0xaaa'),
    blockNumber: 10n,
    transactionHash: h('0xbbb'),
    transactionIndex: 0,
    logIndex: 0,
    topics: [],
    data: h('0x'),
    ...overrides
  };
}

test('confirmation finality computes a safe head', () => {
  assert.equal(safeHead420(100n, { mode: 'confirmations', confirmations: 12n }), 88n);
  assert.equal(safeHead420(5n, { mode: 'confirmations', confirmations: 12n }), 0n);
});

test('invalid finality policy fails closed', () => {
  assert.throws(() => assertFinalityPolicy420({ mode: 'confirmations', confirmations: 0n }));
  assert.throws(() => assertFinalityPolicy420({ mode: 'head', confirmations: 1n }));
});

test('checkpoint continuation accepts canonical child and rejects gaps', () => {
  const cp = checkpointFromBlock420(420n, block(7n, '0xabc', '0xdef'));
  assert.doesNotThrow(() => assertCheckpointContinuation420(cp, block(8n, '0x123', '0xabc')));
  assert.throws(() => assertCheckpointContinuation420(cp, block(9n, '0x123', '0xabc')), /non-contiguous/);
});

test('checkpoint continuation detects a reorg', () => {
  const cp = checkpointFromBlock420(420n, block(7n, '0xabc', '0xdef'));
  assert.throws(() => assertCheckpointContinuation420(cp, block(8n, '0x123', '0x999')), /reorg detected/);
});

test('logs are canonicalized, removed logs dropped, and duplicates suppressed', () => {
  const ordered = normalizeLogs420([
    log({ transactionIndex: 1, logIndex: 0, transactionHash: h('0xccc') }),
    log({ transactionIndex: 0, logIndex: 1 }),
    log({ transactionIndex: 0, logIndex: 0 }),
    log({ transactionIndex: 0, logIndex: 0 }),
    log({ transactionIndex: 0, logIndex: 2, removed: true })
  ]);

  assert.equal(ordered.length, 3);
  assert.deepEqual(ordered.map((entry) => [entry.transactionIndex, entry.logIndex]), [[0, 0], [0, 1], [1, 0]]);
});
