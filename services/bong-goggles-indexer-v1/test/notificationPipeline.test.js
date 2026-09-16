import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesNotificationPipeline, notificationCandidatesForEvent } from '../src/notificationPipeline.js';

function log(eventName, args = {}, blockNumber = 10, logIndex = 0) {
  return {
    chainId: 420,
    blockNumber,
    blockHash: `0xb${blockNumber}`,
    transactionIndex: 0,
    transactionHash: `0xtx-${blockNumber}`,
    logIndex,
    eventName,
    args,
  };
}

test('follow notification preserves provenance and is non-authoritative', () => {
  const [item] = notificationCandidatesForEvent(log('Followed', { follower:'0xA', subject:'0xB' }));
  assert.equal(item.recipient, '0xb');
  assert.equal(item.actor, '0xa');
  assert.equal(item.kind, 'FOLLOWED');
  assert.equal(item.authoritative, false);
  assert.equal(item.provenance.transactionHash, '0xtx-10');
  assert.ok(item.notificationId);
});

test('self notifications are suppressed', () => {
  const items = notificationCandidatesForEvent(log('Followed', { follower:'0xA', subject:'0xA' }));
  assert.deepEqual(items, []);
});

test('friend acceptance requires canonical request hydration', () => {
  assert.throws(() => notificationCandidatesForEvent(log('FriendRequestAccepted', { requestId:'r1' })), /friend request state/);
  const [item] = notificationCandidatesForEvent(log('FriendRequestAccepted', { requestId:'r1' }), { friendRequest:{ requester:'0xA', recipient:'0xB' } });
  assert.equal(item.recipient, '0xa');
  assert.equal(item.actor, '0xb');
});

test('group join request targets canonical group owner', () => {
  const [item] = notificationCandidatesForEvent(log('GroupJoinRequested', { groupId:'g1', account:'0xA' }), { group:{ owner:'0xOWNER' } });
  assert.equal(item.recipient, '0xowner');
  assert.equal(item.subjectId, 'g1');
});

test('event RSVP targets canonical event owner and preserves RSVP state', () => {
  const [item] = notificationCandidatesForEvent(log('EventRSVP', { eventId:'e1', account:'0xB', state:'GOING' }), { eventRecord:{ owner:'0xA' } });
  assert.equal(item.recipient, '0xa');
  assert.equal(item.metadata.state, 'GOING');
});

test('review/correction/verification activity targets discovery submitter', () => {
  const state = { subject:{ submitter:'0xOWNER' } };
  assert.equal(notificationCandidatesForEvent(log('ReviewPublished', { reviewId:'r1', subjectId:'s1', author:'0xA', ratingBps:9000 }), state)[0].kind, 'REVIEW_PUBLISHED');
  assert.equal(notificationCandidatesForEvent(log('CorrectionSubmitted', { correctionId:'c1', subjectId:'s1', author:'0xB' }), state)[0].recipient, '0xowner');
  assert.equal(notificationCandidatesForEvent(log('VerificationAttested', { verificationId:'v1', subjectId:'s1', verifier:'0xC', supportsProposition:true }), state)[0].metadata.supportsProposition, true);
});

test('pipeline deduplicates deterministic replay and advances non-authoritative checkpoint', () => {
  const pipeline = new BongGogglesNotificationPipeline();
  const source = log('Followed', { follower:'0xA', subject:'0xB' });
  const first = pipeline.process(source);
  const replay = pipeline.process(source);
  assert.equal(first.length, 1);
  assert.equal(replay.length, 0);
  assert.equal(pipeline.snapshot().deliveredIds.length, 1);
  assert.equal(pipeline.snapshot().checkpoint.blockNumber, 10);
  assert.equal(pipeline.snapshot().authoritative, false);
});

test('snapshot restore preserves replay safety', () => {
  const source = log('Followed', { follower:'0xA', subject:'0xB' });
  const a = new BongGogglesNotificationPipeline();
  a.process(source);
  const b = new BongGogglesNotificationPipeline();
  b.restore(a.snapshot());
  assert.equal(b.process(source).length, 0);
});

test('canonicality updates are append-only presentation metadata', () => {
  const pipeline = new BongGogglesNotificationPipeline();
  const update = pipeline.canonicalUpdate({ kind:'retracted', eventNotificationIds:['b','a'] });
  assert.deepEqual(update.eventNotificationIds, ['a','b']);
  assert.equal(update.authoritative, false);
  assert.throws(() => pipeline.canonicalUpdate({ kind:'rewritten' }), /invalid canonical update/);
});

test('unmapped events intentionally emit no candidate', () => {
  assert.deepEqual(notificationCandidatesForEvent(log('ProfileUpdated', {}), {}), []);
});
