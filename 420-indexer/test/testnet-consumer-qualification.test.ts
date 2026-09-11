import test from 'node:test';
import assert from 'node:assert/strict';
import type { IndexerPublicApi420 } from '../src/api-surface.js';
import { runTestnetConsumerQualification420 } from '../src/testnet-consumer-qualification.js';

const chainId = 420420n;
const blockNumber = '42';
const txHash = `0x${'12'.repeat(32)}`;
const address = `0x${'34'.repeat(20)}`;
const assetKey = 'native:420420';
const protocol = '420Registry';
const objectKey = 'registry:example';
const blockHash = `0x${'56'.repeat(32)}`;
const contractAddress = `0x${'78'.repeat(20)}`;

function page420<T>(item: T) { return { items: [item], nextCursor: null }; }

function api420(overrides: Partial<IndexerPublicApi420> = {}): IndexerPublicApi420 {
  const block = { chainId: chainId.toString(), number: blockNumber, hash: blockHash, parentHash: `0x${'11'.repeat(32)}`, timestamp: '1700000042' };
  const transaction = { chainId: chainId.toString(), hash: txHash, blockNumber, blockHash, transactionIndex: 0, from: address, to: contractAddress, valueWei: '1', input: '0x' };
  const receipt = { chainId: chainId.toString(), transactionHash: txHash, blockNumber, blockHash, transactionIndex: 0, status: 1 as const, contractAddress: null };
  const log = { chainId: chainId.toString(), blockNumber, blockHash, transactionHash: txHash, transactionIndex: 0, logIndex: 0, address, topics: ['0x01'], data: '0x00' };
  const transfer = { chainId: chainId.toString(), blockNumber, transactionHash: txHash, logIndex: 0, assetKey, assetKind: 'native', contractAddress: null, tokenId: null, from: address, to: contractAddress, amount: '1' };
  const event = { chainId: chainId.toString(), blockNumber, blockHash, transactionHash: txHash, transactionIndex: 0, logIndex: 0, contractAddress, protocol, eventName: 'Registered', objectKey, lifecycleState: 'active', fields: { key: objectKey } };
  const object = { ...event, objectKey };

  return {
    version: 'v1',
    async health() { return { status: 'ok', apiVersion: 'v1' }; },
    async readiness() { return { ready: true, databaseReady: true, chainId: chainId.toString(), indexedHead: '50' }; },
    async status() { return { chainId: chainId.toString(), indexedHead: '50', indexedHeadHash: blockHash, indexedHeadTimestamp: '1700000050', finality: { mode: 'head', confirmations: null, safeHead: '50' }, lag: '0', authoritative: false }; },
    async blocks() { return page420(block); },
    async block() { return block; },
    async transactions() { return page420(transaction); },
    async transaction() { return transaction; },
    async receipt() { return receipt; },
    async logs() { return page420(log); },
    async address() { return { chainId: chainId.toString(), address, isContract: false }; },
    async assetTransfers() { return page420(transfer); },
    async protocolEvents() { return page420(event); },
    async protocolObject() { return object; },
    async search() { return [{ type: 'transaction', key: txHash, value: txHash }]; },
    ...overrides,
  };
}

const witnesses = { blockNumber, transactionHash: txHash, address, assetKey, protocol, objectKey };

test('IDX-10.4 qualifies the stable public API and replayable event-stream boundary', async () => {
  const report = await runTestnetConsumerQualification420(api420(), chainId, witnesses);
  assert.deepEqual(report, {
    chainId: chainId.toString(),
    indexedHead: '50',
    blockNumber,
    transactionHash: txHash,
    address,
    logCount: 1,
    assetTransferCount: 1,
    protocolEventCount: 1,
    streamEventCount: 1,
    searchResultCount: 1,
  });
});

test('IDX-10.4 fails closed when readiness does not admit traffic', async () => {
  await assert.rejects(
    () => runTestnetConsumerQualification420(api420({
      async readiness() { return { ready: false, databaseReady: true, chainId: chainId.toString(), indexedHead: '50' }; },
    }), chainId, witnesses),
    /readiness qualification failed/,
  );
});

test('IDX-10.4 refuses stale witness data beyond the indexed head', async () => {
  await assert.rejects(
    () => runTestnetConsumerQualification420(api420({
      async status() { return { chainId: chainId.toString(), indexedHead: '41', indexedHeadHash: blockHash, indexedHeadTimestamp: '1700000041', finality: { mode: 'head', confirmations: null, safeHead: '41' }, lag: '0', authoritative: false }; },
    }), chainId, witnesses),
    /has not reached block witness 42/,
  );
});

test('IDX-10.4 requires direct resources and consumer feeds to contain the configured witnesses', async () => {
  await assert.rejects(
    () => runTestnetConsumerQualification420(api420({ async transaction() { return null; } }), chainId, witnesses),
    /transaction witness was not available/,
  );
  await assert.rejects(
    () => runTestnetConsumerQualification420(api420({ async logs() { return { items: [], nextCursor: null }; } }), chainId, witnesses),
    /log feed returned no witness data/,
  );
  await assert.rejects(
    () => runTestnetConsumerQualification420(api420({ async protocolObject() { return null; } }), chainId, witnesses),
    /protocol object witness was not available/,
  );
});

test('IDX-10.4 requires non-authoritative replay metadata from the notification event stream', async () => {
  const badEvent = { chainId: chainId.toString(), blockNumber, blockHash, transactionHash: txHash, transactionIndex: 0, logIndex: 0, contractAddress, protocol: 'wrong-protocol', eventName: 'Registered', objectKey, lifecycleState: 'active', fields: {} };
  await assert.rejects(
    () => runTestnetConsumerQualification420(api420({ async protocolEvents() { return page420(badEvent); } }), chainId, witnesses),
    /canonicality metadata was invalid/,
  );
});
