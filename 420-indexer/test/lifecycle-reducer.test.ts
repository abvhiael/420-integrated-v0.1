import test from 'node:test';
import assert from 'node:assert/strict';
import type { DecodedProtocolEvent420 } from '../src/protocol-decoder.js';
import { protocolObjectKey420, reduceProtocolLifecycle420 } from '../src/lifecycle-reducer.js';

function event(protocol: string, eventName: string, blockNumber: bigint, fields: Record<string, string | bigint | boolean>): DecodedProtocolEvent420 {
  return {
    protocol,
    eventName,
    contractAddress: '0x0000000000000000000000000000000000000435',
    blockNumber,
    blockHash: `0x${blockNumber.toString(16).padStart(64,'0')}` as `0x${string}`,
    transactionHash: `0x${(blockNumber + 100n).toString(16).padStart(64,'0')}` as `0x${string}`,
    transactionIndex: 0,
    logIndex: 0,
    fields
  };
}

test('extracts canonical object keys from common genesis identifiers', () => {
  const e = event('420Names', 'NameRegistered', 1n, { labelHash: '0xabc', owner: '0xdef' });
  assert.equal(protocolObjectKey420(e), 'labelHash:0xabc');
});

test('420Pay lifecycle uses canonical PaymentSet status and PaymentAuthorized events', () => {
  const snapshots = reduceProtocolLifecycle420([
    event('420Pay', 'PaymentSet', 3n, { paymentId: '0x01', status: 5n }),
    event('420Pay', 'PaymentSet', 1n, { paymentId: '0x01', status: 1n }),
    event('420Pay', 'PaymentAuthorized', 2n, { paymentId: '0x01' })
  ]);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].state, 'COMPLETED');
  assert.equal(snapshots[0].terminal, true);
  assert.equal(snapshots[0].eventName, 'PaymentSet');
});

test('420Pay partial refund remains nonterminal while full refund is terminal', () => {
  const partial = reduceProtocolLifecycle420([
    event('420Pay', 'PaymentSet', 1n, { paymentId: '0x02', status: 4n }),
    event('420Pay', 'PaymentSet', 2n, { paymentId: '0x02', status: 7n })
  ]);
  assert.equal(partial[0].state, 'ACTIVE');
  assert.equal(partial[0].terminal, false);
  const full = reduceProtocolLifecycle420([
    event('420Pay', 'PaymentSet', 1n, { paymentId: '0x03', status: 4n }),
    event('420Pay', 'PaymentSet', 2n, { paymentId: '0x03', status: 6n })
  ]);
  assert.equal(full[0].state, 'COMPLETED');
  assert.equal(full[0].terminal, true);
});

test('obsolete synthetic Pay events do not fabricate payment lifecycle state', () => {
  const snapshots = reduceProtocolLifecycle420([
    event('420Pay', 'PaymentCreated', 1n, { paymentId: '0x04' }),
    event('420Pay', 'PaymentSettled', 2n, { paymentId: '0x04' })
  ]);
  assert.deepEqual(snapshots, []);
});

test('terminal lifecycle states cannot be resurrected by later events', () => {
  const snapshots = reduceProtocolLifecycle420([
    event('420Randomness', 'RandomnessRequested', 1n, { requestId: '0x02' }),
    event('420Randomness', 'RandomnessFulfilled', 2n, { requestId: '0x02' }),
    event('420Randomness', 'RandomnessRequested', 3n, { requestId: '0x02' })
  ]);
  assert.equal(snapshots[0].state, 'COMPLETED');
  assert.equal(snapshots[0].blockNumber, 2n);
});

test('unknown protocol events do not fabricate lifecycle state', () => {
  const snapshots = reduceProtocolLifecycle420([
    event('420Names', 'ResolutionUpdated', 1n, { labelHash: '0x03' })
  ]);
  assert.deepEqual(snapshots, []);
});


test('reconstructs canonical Civic proposal lifecycle from Proposal Registry events', () => {
  const snapshots = reduceProtocolLifecycle420([
    event('420Governance', 'CivicProposalStateChanged', 4n, { proposalId: '0x04', previousState: 4n, newState: 5n }),
    event('420Governance', 'CivicProposalRegistered', 1n, { proposalId: '0x04' }),
    event('420Governance', 'CivicProposalStateChanged', 2n, { proposalId: '0x04', previousState: 1n, newState: 2n }),
    event('420Governance', 'CivicProposalStateChanged', 3n, { proposalId: '0x04', previousState: 2n, newState: 4n })
  ]);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].objectKey, 'proposalId:0x04');
  assert.equal(snapshots[0].state, 'EXECUTED');
  assert.equal(snapshots[0].terminal, true);
  assert.equal(snapshots[0].eventName, 'CivicProposalStateChanged');
});

test('Governance lifecycle replay is idempotent and replacement-fork rebuild is deterministic', () => {
  const registered = event('420Governance', 'CivicProposalRegistered', 1n, { proposalId: '0x05' });
  const passed = event('420Governance', 'CivicProposalStateChanged', 2n, {
    proposalId: '0x05', previousState: 1n, newState: 2n
  });
  const failed = event('420Governance', 'CivicProposalStateChanged', 2n, {
    proposalId: '0x05', previousState: 1n, newState: 3n
  });

  const replayed = reduceProtocolLifecycle420([registered, passed, registered, passed]);
  assert.equal(replayed[0].state, 'PASSED');

  const replacementFork = reduceProtocolLifecycle420([registered, failed]);
  assert.equal(replacementFork[0].state, 'FAILED');
  assert.equal(replacementFork[0].terminal, true);
});

test('does not synthesize Civic v1 cancellation from non-canonical or unsupported cancellation state', () => {
  const snapshots = reduceProtocolLifecycle420([
    event('420Governance', 'CivicProposalRegistered', 1n, { proposalId: '0x06' }),
    event('420Governance', 'CivicProposalCancelled', 2n, { proposalId: '0x06' }),
    event('420Governance', 'CivicProposalStateChanged', 3n, { proposalId: '0x06', previousState: 1n, newState: 6n })
  ]);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].state, 'ACTIVE');
  assert.equal(snapshots[0].eventName, 'CivicProposalRegistered');
});


test('420Stake lifecycle uses canonical ValidatorRegistry events and status fields', () => {
  const validatorId = '0x' + '42'.repeat(32);
  const snapshots = reduceProtocolLifecycle420([
    event('420Stake', 'ValidatorRegistered', 1n, { validatorId }),
    event('420Stake', 'ConsensusStateApplied', 2n, { validatorId, previousStatus: 1n, newStatus: 3n }),
    event('420Stake', 'ExitNoticeApplied', 3n, { validatorId, noticeRotation: 4n, exitEligibleRotation: 5n }),
    event('420Stake', 'ConsensusStateApplied', 4n, { validatorId, previousStatus: 3n, newStatus: 8n }),
    event('420Stake', 'ValidatorBondWithdrawn', 5n, { validatorId })
  ]);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].state, 'COMPLETED');
  assert.equal(snapshots[0].terminal, true);
  assert.equal(snapshots[0].eventName, 'ValidatorBondWithdrawn');
});

test('420Stake slash status remains reconstructable without inventing terminality', () => {
  const validatorId = '0x' + '24'.repeat(32);
  const snapshots = reduceProtocolLifecycle420([
    event('420Stake', 'ValidatorRegistered', 1n, { validatorId }),
    event('420Stake', 'SlashApplied', 2n, { validatorId, resultingStatus: 6n })
  ]);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].state, 'FAILED');
  assert.equal(snapshots[0].terminal, false);
  assert.equal(snapshots[0].eventName, 'SlashApplied');
});

test('obsolete synthetic Stake events do not fabricate validator lifecycle state', () => {
  const snapshots = reduceProtocolLifecycle420([
    event('420Stake', 'StakeCreated', 1n, { stakeId: '0x01' }),
    event('420Stake', 'StakeActivated', 2n, { stakeId: '0x01' })
  ]);
  assert.deepEqual(snapshots, []);
});
