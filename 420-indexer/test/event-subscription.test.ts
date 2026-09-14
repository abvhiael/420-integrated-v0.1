import test from 'node:test';
import assert from 'node:assert/strict';
import { indexerEventEnvelope420 } from '../src/event-stream.js';
import {
  filterIndexerEventsForSubscription420,
  indexerEventMatchesSubscription420,
  matchIndexerEventSubscriptions420,
  normalizeIndexerEventSubscription420
} from '../src/event-subscription.js';
import type { ProtocolEventDto420 } from '../src/public-dto.js';

const SOURCE_EVENT_420: ProtocolEventDto420 = {
  chainId: '420',
  blockNumber: '101',
  blockHash: '0xBlock',
  transactionHash: '0xTx',
  transactionIndex: 1,
  logIndex: 3,
  contractAddress: '0xAbCd',
  protocol: '420Governance',
  eventName: 'ProposalActivated',
  objectKey: 'proposal:42',
  lifecycleState: 'ACTIVE',
  fields: { proposalId: '42' }
};

const EVENT_420 = indexerEventEnvelope420(SOURCE_EVENT_420);

test('subscription matching requires explicit selectors and an enabled subscription', () => {
  assert.throws(
    () => normalizeIndexerEventSubscription420({ id: 'sub-1', enabled: true }),
    /at least one selector/
  );
  assert.equal(indexerEventMatchesSubscription420({ id: 'sub-1', enabled: false, protocols: ['420Governance'] }, EVENT_420), false);
});

test('subscription matching combines selectors deterministically', () => {
  const subscription = {
    id: 'sub-governance-42',
    enabled: true,
    chainIds: ['420'],
    protocols: ['420Governance'],
    eventNames: ['ProposalActivated'],
    topics: ['420Governance.ProposalActivated'],
    objectKeys: ['proposal:42'],
    lifecycleStates: ['ACTIVE'],
    contractAddresses: ['0xABCD']
  };
  assert.equal(indexerEventMatchesSubscription420(subscription, EVENT_420), true);
  assert.equal(indexerEventMatchesSubscription420({ ...subscription, objectKeys: ['proposal:7'] }, EVENT_420), false);
});

test('contract-address matching is case-insensitive while protocol and object keys stay exact', () => {
  assert.equal(indexerEventMatchesSubscription420({ id: 'address', enabled: true, contractAddresses: ['0xabcd'] }, EVENT_420), true);
  assert.equal(indexerEventMatchesSubscription420({ id: 'protocol-case', enabled: true, protocols: ['420governance'] }, EVENT_420), false);
  assert.equal(indexerEventMatchesSubscription420({ id: 'object-case', enabled: true, objectKeys: ['Proposal:42'] }, EVENT_420), false);
});

test('matcher returns deterministic subscription/event identities and rejects duplicate subscription ids', () => {
  const subscriptions = [
    { id: 'sub-a', enabled: true, protocols: ['420Governance'] },
    { id: 'sub-b', enabled: true, lifecycleStates: ['ACTIVE'] },
    { id: 'sub-c', enabled: true, protocols: ['420Pay'] }
  ];
  assert.deepEqual(matchIndexerEventSubscriptions420(subscriptions, EVENT_420), [
    { subscriptionId: 'sub-a', eventId: EVENT_420.id, matched: true },
    { subscriptionId: 'sub-b', eventId: EVENT_420.id, matched: true }
  ]);
  assert.throws(
    () => matchIndexerEventSubscriptions420([
      { id: 'same', enabled: true, protocols: ['420Governance'] },
      { id: 'same', enabled: true, eventNames: ['ProposalActivated'] }
    ], EVENT_420),
    /duplicate subscription id/
  );
});

test('event filtering preserves event order and does not mutate stream envelopes', () => {
  const other = indexerEventEnvelope420({
    ...SOURCE_EVENT_420,
    transactionHash: '0xTx2',
    logIndex: 4,
    protocol: '420Pay',
    eventName: 'PaymentSettled',
    objectKey: 'payment:9',
    lifecycleState: 'COMPLETED'
  });
  const filtered = filterIndexerEventsForSubscription420(
    { id: 'governance', enabled: true, protocols: ['420Governance'] },
    [EVENT_420, other]
  );
  assert.deepEqual(filtered, [EVENT_420]);
  assert.equal(filtered[0]?.authoritative, false);
});

test('malformed selectors fail closed', () => {
  assert.throws(() => normalizeIndexerEventSubscription420({ id: '', enabled: true, protocols: ['420Governance'] }), /id must not be empty/);
  assert.throws(() => normalizeIndexerEventSubscription420({ id: 'bad', enabled: true, protocols: [] }), /protocols must not be empty/);
  assert.throws(() => normalizeIndexerEventSubscription420({ id: 'bad', enabled: true, objectKeys: [' '] }), /invalid objectKeys/);
});
