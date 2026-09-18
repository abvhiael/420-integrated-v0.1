import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesNotificationPipeline, notificationCandidatesForEvent } from '../src/notificationPipeline.js';

function log(eventName, args = {}, blockNumber = 20, logIndex = 0) {
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

test('group join request targets hydrated active group owner', () => {
  const [item] = notificationCandidatesForEvent(
    log('GroupJoinRequested', { groupId:'g1', account:'0xA' }),
    { group:{ owner:'0xOWNER', exists:true, active:true } },
  );
  assert.equal(item.recipient, '0xowner');
  assert.equal(item.actor, '0xa');
  assert.equal(item.kind, 'GROUP_JOIN_REQUESTED');
});

test('inactive groups suppress join-request notifications', () => {
  const items = notificationCandidatesForEvent(
    log('GroupJoinRequested', { groupId:'g1', account:'0xA' }),
    { group:{ owner:'0xOWNER', exists:true, active:false } },
  );
  assert.deepEqual(items, []);
});

test('member activation requires canonical active membership', () => {
  assert.throws(
    () => notificationCandidatesForEvent(log('GroupMemberActivated', { groupId:'g1', account:'0xA', role:'MEMBER' }), { group:{ owner:'0xOWNER', active:true } }),
    /group member state/,
  );
  const [item] = notificationCandidatesForEvent(
    log('GroupMemberActivated', { groupId:'g1', account:'0xA', role:'MEMBER' }),
    { group:{ owner:'0xOWNER', exists:true, active:true }, groupMember:{ state:'ACTIVE', role:'MEMBER' } },
  );
  assert.equal(item.recipient, '0xa');
  assert.equal(item.actor, '0xowner');
  assert.equal(item.metadata.role, 'MEMBER');
});

test('member removal requires canonical removed membership and does not invent an actor', () => {
  const [item] = notificationCandidatesForEvent(
    log('GroupMemberRemoved', { groupId:'g1', account:'0xA' }),
    { group:{ owner:'0xOWNER', exists:true }, groupMember:{ state:'REMOVED' } },
  );
  assert.equal(item.recipient, '0xa');
  assert.equal(item.actor, null);
  assert.equal(item.metadata.groupOwner, '0xOWNER');
});

test('group updates fan out only to hydrated eligible recipients', () => {
  const items = notificationCandidatesForEvent(
    log('GroupUpdated', { groupId:'g1', privacy:'PRIVATE', joinPolicy:'APPROVAL_REQUIRED', active:true }),
    {
      group:{ owner:'0xOWNER', exists:true, active:true },
      groupNotificationRecipients:[
        { account:'0xA', active:true },
        { account:'0xB', active:true, notificationsMuted:true },
        { account:'0xOWNER', active:true },
        { account:'0xC', active:false },
      ],
    },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].recipient, '0xa');
  assert.equal(items[0].kind, 'GROUP_ACTIVITY');
  assert.equal(items[0].metadata.privacy, 'PRIVATE');
});

test('event RSVP targets hydrated active event owner', () => {
  const [item] = notificationCandidatesForEvent(
    log('EventRSVP', { eventId:'e1', account:'0xB', state:'GOING' }),
    { eventRecord:{ owner:'0xA', exists:true, active:true } },
  );
  assert.equal(item.recipient, '0xa');
  assert.equal(item.actor, '0xb');
  assert.equal(item.metadata.state, 'GOING');
});

test('event updates fan out to current eligible participants', () => {
  const items = notificationCandidatesForEvent(
    log('EventUpdated', { eventId:'e1', startsAt:100, endsAt:200, active:false }),
    {
      eventRecord:{ owner:'0xOWNER', exists:true, active:false, startsAt:100, endsAt:200 },
      eventNotificationRecipients:[
        { account:'0xA', active:true },
        { account:'0xB', active:true, blockedEither:true },
        { account:'0xOWNER', active:true },
      ],
    },
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].recipient, '0xa');
  assert.equal(items[0].kind, 'EVENT_ACTIVITY');
  assert.equal(items[0].metadata.active, false);
});

test('group/event fanout remains deterministic under replay', () => {
  const source = log('EventUpdated', { eventId:'e1', startsAt:100, endsAt:200, active:true });
  const state = {
    eventRecord:{ owner:'0xOWNER', exists:true, active:true },
    eventNotificationRecipients:[{ account:'0xA', active:true }, { account:'0xB', active:true }],
  };
  const pipeline = new BongGogglesNotificationPipeline();
  assert.equal(pipeline.process(source, state).length, 2);
  assert.equal(pipeline.process(source, state).length, 0);
});
