import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLimit420,
  encodeBlockCursor420, decodeBlockCursor420,
  encodeTransactionCursor420, decodeTransactionCursor420,
  encodePositionCursor420, decodePositionCursor420,
  blocksQuery420, transactionsQuery420, logsQuery420, protocolEventsQuery420, assetTransfersQuery420
} from '../src/query-layer.js';

test('cursor codecs round-trip canonical positions', () => {
  assert.deepEqual(decodeBlockCursor420(encodeBlockCursor420({ blockNumber: 42n })), { blockNumber: 42n });
  assert.deepEqual(decodeTransactionCursor420(encodeTransactionCursor420({ blockNumber: 42n, txIndex: 7 })), { blockNumber: 42n, txIndex: 7 });
  assert.deepEqual(decodePositionCursor420(encodePositionCursor420({ blockNumber: 42n, txIndex: 7, logIndex: 3 })), { blockNumber: 42n, txIndex: 7, logIndex: 3 });
});

test('limits are bounded and fail closed', () => {
  assert.equal(normalizeLimit420(), 50);
  assert.equal(normalizeLimit420(200), 200);
  assert.throws(() => normalizeLimit420(0), /between 1 and 200/);
  assert.throws(() => normalizeLimit420(201), /between 1 and 200/);
  assert.throws(() => decodeBlockCursor420('not-a-cursor'), /invalid/);
});

test('blocks use keyset pagination and fetch one extra row', () => {
  const cursor = encodeBlockCursor420({ blockNumber: 100n });
  const query = blocksQuery420(420n, { cursor, limit: 25 });
  assert.match(query.text, /block_number < \$2/);
  assert.match(query.text, /order by block_number desc/);
  assert.deepEqual(query.params, ['420','100',26]);
});

test('address transaction query preserves tuple ordering', () => {
  const cursor = encodeTransactionCursor420({ blockNumber: 100n, txIndex: 5 });
  const query = transactionsQuery420(420n, { address: '0xABC', cursor, limit: 10 });
  assert.match(query.text, /from_address = \$2 or to_address = \$2/);
  assert.match(query.text, /\(block_number, tx_index\) < \(\$3, \$4\)/);
  assert.match(query.text, /order by block_number desc, tx_index desc/);
  assert.deepEqual(query.params, ['420','0xabc','100',5,11]);
});

test('log and protocol queries use canonical block tx log position', () => {
  const cursor = encodePositionCursor420({ blockNumber: 88n, txIndex: 2, logIndex: 9 });
  const logs = logsQuery420(420n, { address: '0xDEF', cursor, limit: 5 });
  assert.match(logs.text, /\(block_number, tx_index, log_index\) < \(\$3, \$4, \$5\)/);
  assert.deepEqual(logs.params, ['420','0xdef','88',2,9,6]);

  const events = protocolEventsQuery420(420n, { protocol: '420Names', objectKey: 'abc', cursor, limit: 5 });
  assert.match(events.text, /idx_protocol_object_events/);
  assert.match(events.text, /protocol = \$2/);
  assert.match(events.text, /object_key = \$3/);
  assert.deepEqual(events.params, ['420','420Names','abc','88',2,9,6]);
});

test('asset transfer query is chain scoped and deterministic', () => {
  const query = assetTransfersQuery420(420n, { assetKey: 'erc20:0x1:', address: '0xABC', beforeBlock: 99n, limit: 20 });
  assert.match(query.text, /asset_key = \$2/);
  assert.match(query.text, /from_address = \$3 or to_address = \$3/);
  assert.match(query.text, /block_number < \$4/);
  assert.match(query.text, /order by block_number desc, tx_hash desc, log_index desc nulls last/);
  assert.deepEqual(query.params, ['420','erc20:0x1:','0xabc','99',21]);
});
