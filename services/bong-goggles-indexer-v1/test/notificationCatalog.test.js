import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BONG_GOGGLES_NOTIFICATION_KINDS,
  bongGogglesNotificationDescriptor,
  bongGogglesNotificationTopics,
  validateBongGogglesNotificationCandidate,
} from '../src/notificationCatalog.js';
import { notificationCandidatesForEvent } from '../src/notificationPipeline.js';

function log(eventName, args = {}) {
  return {
    chainId: 420,
    blockNumber: 10,
    blockHash: '0xb10',
    transactionIndex: 0,
    transactionHash: '0xtx-10',
    logIndex: 0,
    eventName,
    args,
  };
}

test('catalog covers current production pipeline kinds', () => {
  const cases = [
    notificationCandidatesForEvent(log('Followed', { follower:'0xA', subject:'0xB' }))[0],
    notificationCandidatesForEvent(log('FriendRequestAccepted', { requestId:'r1' }), { friendRequest:{ requester:'0xA', recipient:'0xB' } })[0],
    notificationCandidatesForEvent(log('Blocked', { blocker:'0xA', subject:'0xB' }))[0],
    notificationCandidatesForEvent(log('GroupJoinRequested', { groupId:'g1', account:'0xA' }), { group:{ owner:'0xB' } })[0],
    notificationCandidatesForEvent(log('EventRSVP', { eventId:'e1', account:'0xA', state:'GOING' }), { eventRecord:{ owner:'0xB' } })[0],
    notificationCandidatesForEvent(log('ReviewPublished', { reviewId:'r1', subjectId:'s1', author:'0xA', ratingBps:9000 }), { subject:{ submitter:'0xB' } })[0],
  ];

  for (const item of cases) {
    const normalized = validateBongGogglesNotificationCandidate(item);
    assert.equal(normalized.authoritative, false);
    assert.ok(normalized.severity);
  }
});

test('catalog reserves production topics for remaining BG-16 emitters', () => {
  const topics = bongGogglesNotificationTopics();
  for (const topic of ['relationships','interactions','groups','events','games','messages','moderation','rewards','discovery','safety']) {
    assert.ok(topics.includes(topic), `missing ${topic}`);
  }
  assert.ok(BONG_GOGGLES_NOTIFICATION_KINDS.includes('GAME_INVITE'));
  assert.ok(BONG_GOGGLES_NOTIFICATION_KINDS.includes('MESSAGE_RECEIVED'));
  assert.ok(BONG_GOGGLES_NOTIFICATION_KINDS.includes('APPEAL_UPDATED'));
  assert.ok(BONG_GOGGLES_NOTIFICATION_KINDS.includes('REWARD_EARNED'));
});

test('private message notifications explicitly forbid payload carriage', () => {
  const descriptor = bongGogglesNotificationDescriptor('MESSAGE_RECEIVED');
  assert.equal(descriptor.metadataOnly, true);
  assert.equal(descriptor.privatePayloadForbidden, true);
});

test('candidate validation rejects authority and topic drift', () => {
  const candidate = notificationCandidatesForEvent(log('Followed', { follower:'0xA', subject:'0xB' }))[0];
  assert.throws(() => validateBongGogglesNotificationCandidate({ ...candidate, authoritative:true }), /non-authoritative/);
  assert.throws(() => validateBongGogglesNotificationCandidate({ ...candidate, topic:'games' }), /topic does not match/);
});

test('unknown notification kinds fail closed', () => {
  assert.throws(() => bongGogglesNotificationDescriptor('UNKNOWN_KIND'), /unsupported/);
});
