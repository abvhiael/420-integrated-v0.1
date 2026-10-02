import test from 'node:test';
import assert from 'node:assert/strict';
import type { IndexerPublicApi420, ProtocolEventPageRequest420 } from '../src/api-surface.js';
import { IndexerEventStream420, indexerEventEnvelope420, indexerEventId420 } from '../src/event-stream.js';
import type { ProtocolEventDto420 } from '../src/public-dto.js';

const EVENT_420: ProtocolEventDto420 = {
  chainId: '420',
  blockNumber: '77',
  blockHash: '0xBlock',
  transactionHash: '0xTx',
  transactionIndex: 2,
  logIndex: 4,
  contractAddress: '0xContract',
  protocol: '420Governance',
  eventName: 'CivicProposalRegistered',
  objectKey: 'proposalId:0x42',
  lifecycleState: 'ACTIVE',
  fields: { proposalId: '0x42', proposer: '0xabc' }
};

test('event stream identity is deterministic and fork-sensitive', () => {
  const first = indexerEventId420(EVENT_420);
  const replay = indexerEventId420({ ...EVENT_420 });
  const replacementFork = indexerEventId420({ ...EVENT_420, blockHash: '0xOtherBlock' });

  assert.equal(first, replay);
  assert.notEqual(first, replacementFork);
  assert.match(first, /^420evt:v1:420:/);
});

test('event envelope preserves provenance without claiming protocol authority', () => {
  const event = indexerEventEnvelope420(EVENT_420);

  assert.equal(event.topic, '420Governance.CivicProposalRegistered');
  assert.equal(event.authoritative, false);
  assert.deepEqual(event.provenance, {
    chainId: '420',
    blockNumber: '77',
    blockHash: '0xBlock',
    transactionHash: '0xTx',
    transactionIndex: 2,
    logIndex: 4,
    contractAddress: '0xContract'
  });
  assert.deepEqual(event.fields, { proposalId: '0x42', proposer: '0xabc' });
});

test('event stream replays through the stable public API and preserves opaque cursors', async () => {
  const calls: Array<{ chainId: bigint; request: ProtocolEventPageRequest420 }> = [];
  const api: Pick<IndexerPublicApi420, 'protocolEvents'> = {
    async protocolEvents(chainId, request = {}) {
      calls.push({ chainId, request });
      return { items: [EVENT_420], nextCursor: 'opaque-next' };
    }
  };

  const stream = new IndexerEventStream420(api);
  const batch = await stream.protocolEvents(420n, {
    cursor: 'opaque-current',
    limit: 25,
    direction: 'asc',
    protocol: '420Governance',
    objectKey: 'proposalId:0x42'
  });

  assert.deepEqual(calls, [{
    chainId: 420n,
    request: {
      cursor: 'opaque-current',
      limit: 25,
      direction: 'asc',
      protocol: '420Governance',
      objectKey: 'proposalId:0x42'
    }
  }]);
  assert.equal(batch.streamVersion, 'v1');
  assert.equal(batch.events.length, 1);
  assert.equal(batch.nextCursor, 'opaque-next');
  assert.equal(batch.authoritative, false);
});

test('event identity fails closed on malformed source identity', () => {
  assert.throws(() => indexerEventId420({ ...EVENT_420, blockHash: '' }), /invalid protocol event identity/);
  assert.throws(() => indexerEventId420({ ...EVENT_420, logIndex: -1 }), /invalid protocol event identity/);
});

test('Governance event subscriptions stay explicitly non-authoritative with canonical Civic topics', async () => {
  const api: Pick<IndexerPublicApi420, 'protocolEvents'> = {
    async protocolEvents(_chainId, request = {}) {
      assert.equal(request.protocol, '420Governance');
      assert.equal(request.objectKey, 'proposalId:0x42');
      return { items: [EVENT_420], nextCursor: null };
    }
  };
  const batch = await new IndexerEventStream420(api).protocolEvents(420n, {
    protocol: '420Governance',
    objectKey: 'proposalId:0x42'
  });
  assert.equal(batch.authoritative, false);
  assert.equal(batch.events[0]!.topic, '420Governance.CivicProposalRegistered');
  assert.equal(batch.events[0]!.authoritative, false);
});
