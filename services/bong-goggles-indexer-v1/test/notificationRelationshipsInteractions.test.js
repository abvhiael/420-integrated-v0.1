import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesNotificationPipeline, notificationCandidatesForEvent } from '../src/notificationPipeline.js';

function log(eventName, args = {}, logIndex = 0) {
  return {
    chainId: 420,
    blockNumber: 16,
    blockHash: '0xb16',
    transactionIndex: 0,
    transactionHash: '0xtx-16',
    logIndex,
    eventName,
    args,
  };
}

const allow = {
  notificationPolicy: {
    actorActive: true,
    recipientActive: true,
    blockedEither: false,
    notificationsMuted: false,
    canInteract: true,
    canMention: true,
  },
};

test('friend and follow requests emit deterministic relationship notifications', () => {
  const [friend] = notificationCandidatesForEvent(log('FriendRequestCreated', {
    requestId:'fr1', requester:'0xA', recipient:'0xB',
  }), allow);
  assert.equal(friend.kind, 'FRIEND_REQUEST_RECEIVED');
  assert.equal(friend.recipient, '0xb');
  assert.equal(friend.actor, '0xa');
  assert.equal(friend.subjectId, 'fr1');

  const [follow] = notificationCandidatesForEvent(log('FollowRequestCreated', {
    requestId:'fo1', follower:'0xA', subject:'0xB',
  }, 1), allow);
  assert.equal(follow.kind, 'FOLLOW_REQUEST_RECEIVED');
  assert.equal(follow.recipient, '0xb');
});

test('relationship request emitters fail closed on current block/policy state', () => {
  const source = log('FriendRequestCreated', { requestId:'fr1', requester:'0xA', recipient:'0xB' });
  assert.throws(() => notificationCandidatesForEvent(source), /notification policy state/);
  assert.deepEqual(notificationCandidatesForEvent(source, { notificationPolicy:{ ...allow.notificationPolicy, blockedEither:true } }), []);
  assert.deepEqual(notificationCandidatesForEvent(source, { notificationPolicy:{ ...allow.notificationPolicy, recipientActive:false } }), []);
  assert.deepEqual(notificationCandidatesForEvent(source, { notificationPolicy:{ ...allow.notificationPolicy, notificationsMuted:true } }), []);
});

test('comment notification hydrates canonical comment and parent and suppresses self comments', () => {
  const state = {
    ...allow,
    socialObject: { objectId:'c1', objectType:3, author:'0xA', parentId:'p1', rootId:'p1', status:0 },
    parentObject: { objectId:'p1', author:'0xB', status:0 },
  };
  const [item] = notificationCandidatesForEvent(log('SocialObjectPublished', {
    objectId:'c1', author:'0xA', objectType:3, parentId:'p1', version:1,
  }), state);
  assert.equal(item.kind, 'COMMENT_CREATED');
  assert.equal(item.recipient, '0xb');
  assert.equal(item.metadata.parentId, 'p1');

  const selfState = { ...state, parentObject:{ objectId:'p1', author:'0xA', status:0 } };
  assert.deepEqual(notificationCandidatesForEvent(log('SocialObjectPublished', {
    objectId:'c1', author:'0xA', objectType:3, parentId:'p1', version:1,
  }), selfState), []);
});

test('non-comment social objects do not become interaction notifications', () => {
  const items = notificationCandidatesForEvent(log('SocialObjectPublished', {
    objectId:'s1', author:'0xA', objectType:0, parentId:null, version:1,
  }), {
    ...allow,
    socialObject:{ objectId:'s1', objectType:0, author:'0xA', status:0 },
    parentObject:{ objectId:'p1', author:'0xB', status:0 },
  });
  assert.deepEqual(items, []);
});

test('profile tags become mentions and page/community tags remain tags', () => {
  const [mention] = notificationCandidatesForEvent(log('TagCreated', {
    tagId:'t1', objectId:'o1', target:'0xB', objectAuthor:'0xA', targetType:0, state:2,
  }), allow);
  assert.equal(mention.kind, 'MENTIONED');
  assert.equal(mention.recipient, '0xb');

  const [tag] = notificationCandidatesForEvent(log('TagCreated', {
    tagId:'t2', objectId:'o2', target:'0xC', objectAuthor:'0xA', targetType:1, state:1,
  }, 1), allow);
  assert.equal(tag.kind, 'TAGGED');
  assert.equal(tag.metadata.tagState, 1);
});

test('mention emission revalidates canMention and block state', () => {
  const source = log('TagCreated', {
    tagId:'t1', objectId:'o1', target:'0xB', objectAuthor:'0xA', targetType:0, state:2,
  });
  assert.deepEqual(notificationCandidatesForEvent(source, {
    notificationPolicy:{ ...allow.notificationPolicy, canMention:false },
  }), []);
  assert.deepEqual(notificationCandidatesForEvent(source, {
    notificationPolicy:{ ...allow.notificationPolicy, blockedEither:true },
  }), []);
});

test('BG-16.2 replay is deduplicated by deterministic notification id', () => {
  const pipeline = new BongGogglesNotificationPipeline();
  const source = log('FriendRequestCreated', { requestId:'fr1', requester:'0xA', recipient:'0xB' });
  assert.equal(pipeline.process(source, allow).length, 1);
  assert.equal(pipeline.process(source, allow).length, 0);
  assert.equal(pipeline.snapshot().deliveredIds.length, 1);
});
