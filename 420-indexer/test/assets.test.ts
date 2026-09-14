import test from 'node:test';
import assert from 'node:assert/strict';
import type { Hex, IndexerLog, IndexerTransaction } from '../src/chain-source.js';
import {
  ERC1155_TRANSFER_BATCH_TOPIC_420,
  ERC1155_TRANSFER_SINGLE_TOPIC_420,
  ERC_TRANSFER_TOPIC_420,
  NATIVE_TRANSFER_LOG_INDEX_420,
  ZERO_ADDRESS_420,
  decodeAssetLog420,
  decodeNativeTransfer420
} from '../src/asset-decoder.js';

const h = (n: bigint): Hex => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const address = (n: bigint): Hex => `0x${n.toString(16).padStart(40, '0')}` as Hex;
const topicAddress = (n: bigint): Hex => h(n);
const words = (...values: bigint[]): Hex => `0x${values.map((v) => v.toString(16).padStart(64, '0')).join('')}` as Hex;

function log(topic0: Hex, topics: Hex[], data: Hex): IndexerLog {
  return { address: address(99n), blockHash: h(10n), blockNumber: 10n, transactionHash: h(11n), transactionIndex: 0, logIndex: 1, topics: [topic0, ...topics], data };
}

test('decodes ERC20 and ERC721 Transfer shapes deterministically', () => {
  const erc20 = decodeAssetLog420(log(ERC_TRANSFER_TOPIC_420, [topicAddress(1n), topicAddress(2n)], words(420n)));
  assert.deepEqual(erc20.map(({ kind, tokenId, amount, from, to }) => ({ kind, tokenId, amount, from, to })), [
    { kind: 'erc20', tokenId: null, amount: 420n, from: address(1n), to: address(2n) }
  ]);

  const erc721 = decodeAssetLog420(log(ERC_TRANSFER_TOPIC_420, [topicAddress(1n), topicAddress(2n), h(7n)], '0x'));
  assert.equal(erc721[0].kind, 'erc721');
  assert.equal(erc721[0].tokenId, 7n);
  assert.equal(erc721[0].amount, 1n);
});

test('decodes ERC1155 TransferSingle mint semantics', () => {
  const decoded = decodeAssetLog420(log(ERC1155_TRANSFER_SINGLE_TOPIC_420, [topicAddress(9n), h(0n), topicAddress(2n)], words(7n, 3n)));
  assert.equal(decoded[0].kind, 'erc1155');
  assert.equal(decoded[0].tokenId, 7n);
  assert.equal(decoded[0].amount, 3n);
  assert.equal(decoded[0].from, ZERO_ADDRESS_420);
  assert.equal(decoded[0].to, address(2n));
});

test('decodes ERC1155 TransferBatch arrays', () => {
  const data = words(64n, 160n, 2n, 7n, 8n, 2n, 3n, 4n);
  const decoded = decodeAssetLog420(log(ERC1155_TRANSFER_BATCH_TOPIC_420, [topicAddress(9n), topicAddress(1n), topicAddress(2n)], data));
  assert.deepEqual(decoded.map((x) => [x.tokenId, x.amount]), [[7n, 3n], [8n, 4n]]);
});

test('projects native $420 transfers with the deterministic transaction-level sentinel', () => {
  const tx: IndexerTransaction = { hash: h(1n), blockHash: h(2n), blockNumber: 3n, transactionIndex: 0, from: address(1n), to: address(2n), input: '0x', value: 42n };
  const transfer = decodeNativeTransfer420(tx);
  assert.equal(transfer?.kind, 'native');
  assert.equal(transfer?.amount, 42n);
  assert.equal(transfer?.logIndex, NATIVE_TRANSFER_LOG_INDEX_420);
  assert.equal(NATIVE_TRANSFER_LOG_INDEX_420, -1);
  assert.equal(decodeNativeTransfer420({ ...tx, value: 0n }), null);
  assert.equal(decodeNativeTransfer420({ ...tx, to: null }), null);
});
