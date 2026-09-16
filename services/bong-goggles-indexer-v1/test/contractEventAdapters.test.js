import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptBongGogglesEvent, toProjectorEvent } from '../src/contractEventAdapters.js';

const base = {
  chainId: 420,
  blockNumber: 10,
  blockHash: '0xb10',
  transactionIndex: 0,
  transactionHash: '0xtx',
  logIndex: 0,
};

test('profile events require and consume canonical hydrated state', () => {
  const mutations = adaptBongGogglesEvent(
    { eventName: 'ProfileCreated', args: { account: '0xALICE' } },
    { profile: { account: '0xALICE', status: 'ACTIVE', profileType: 'PERSON', displayNameHash: '0xname', metadataRoot: '0xmeta' } },
  );
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].entityType, 'profile');
  assert.equal(mutations[0].entityId, '0xalice');
  assert.equal(mutations[0].value.active, true);
  assert.throws(() => adaptBongGogglesEvent({ eventName: 'ProfileUpdated' }), /canonical profile state/);
});

test('social object lifecycle events hydrate complete canonical object state', () => {
  const state = {
    socialObject: {
      objectId: '0xobj', author: '0xALICE', objectType: 'STATUS', status: 'ACTIVE',
      audienceType: 'PUBLIC', audienceRef: null, parentId: null, sourceObjectId: null,
      contentHash: '0xcontent', version: 2,
    },
  };
  const mutations = adaptBongGogglesEvent({ eventName: 'SocialObjectEdited', args: { objectId: '0xobj' } }, state);
  assert.equal(mutations[0].entityType, 'socialObject');
  assert.equal(mutations[0].value.version, 2);
  assert.equal(mutations[0].value.author, '0xalice');
  assert.deepEqual(adaptBongGogglesEvent({ eventName: 'SocialObjectProvenance' }, state), []);
});

test('relationship transitions map to deterministic upsert/delete mutations', () => {
  assert.equal(adaptBongGogglesEvent({ eventName: 'Followed', args: { follower: '0xA', subject: '0xB' } })[0].operation, 'UPSERT');
  assert.equal(adaptBongGogglesEvent({ eventName: 'Unfollowed', args: { follower: '0xA', subject: '0xB' } })[0].operation, 'DELETE');
  assert.equal(adaptBongGogglesEvent({ eventName: 'Blocked', args: { blocker: '0xA', subject: '0xB' } })[0].value.blocked, true);
  assert.equal(adaptBongGogglesEvent({ eventName: 'Muted', args: { muter: '0xA', subject: '0xB', scopes: 7 } })[0].value.muted, true);
});

test('friend acceptance uses canonical request state because event omits requester', () => {
  const mutation = adaptBongGogglesEvent(
    { eventName: 'FriendRequestAccepted', args: { requestId: '0xreq', recipient: '0xB' } },
    { friendRequest: { requester: '0xA', recipient: '0xB' } },
  )[0];
  assert.equal(mutation.entityId, 'FRIEND:0xa:0xb');
  assert.throws(() => adaptBongGogglesEvent({ eventName: 'FriendRequestAccepted', args: {} }), /friend request state/);
});

test('decoded canonical log is wrapped in BG-12.1 projector envelope', () => {
  const event = toProjectorEvent(
    { ...base, eventName: 'Followed', args: { follower: '0xA', subject: '0xB' } },
  );
  assert.equal(event.chainId, 420);
  assert.equal(event.transactionIndex, 0);
  assert.equal(event.logIndex, 0);
  assert.equal(event.mutations.length, 1);
});

test('unknown events fail closed', () => {
  assert.throws(() => adaptBongGogglesEvent({ eventName: 'MadeUpEvent' }), /unsupported Bong Goggles event/);
});
