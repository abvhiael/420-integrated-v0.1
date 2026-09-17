import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesNotificationPipeline, notificationCandidatesForEvent } from '../src/notificationPipeline.js';
import { validateBongGogglesNotificationCandidate } from '../src/notificationCatalog.js';

function log(eventName, args = {}, blockNumber = 40, logIndex = 0) {
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

function gamePolicy(overrides = {}) {
  return {
    actorActive: true,
    recipientActive: true,
    blockedEither: false,
    notificationsMuted: false,
    gameInvitesMuted: false,
    zeroWager: true,
    canInviteToGame: true,
    ...overrides,
  };
}

function messagePolicy(overrides = {}) {
  return {
    senderActive: true,
    recipientActive: true,
    blockedEither: false,
    notificationsMuted: false,
    conversationActive: true,
    canSend: true,
    ...overrides,
  };
}

test('game invite targets canonical recipient and preserves zero-wager boundary', () => {
  const state = {
    gameSession: { sessionId: 'g1', playerA: '0xA', playerB: '0xB', state: 'INVITED', gameType: 'CHESS', rulesetHash: '0xrules' },
    gameNotificationPolicy: gamePolicy(),
  };
  const [item] = notificationCandidatesForEvent(log('GameInvited', { sessionId:'g1', inviter:'0xA', recipient:'0xB', gameType:'CHESS', rulesetHash:'0xrules' }), state);
  assert.equal(item.kind, 'GAME_INVITE');
  assert.equal(item.recipient, '0xb');
  assert.equal(item.actor, '0xa');
  assert.equal(item.topic, 'games');

  assert.deepEqual(notificationCandidatesForEvent(log('GameInvited', { sessionId:'g1', inviter:'0xA', recipient:'0xB' }), {
    ...state,
    gameNotificationPolicy: gamePolicy({ zeroWager:false }),
  }), []);
});

test('game acceptance notifies inviter from canonical active session', () => {
  const [item] = notificationCandidatesForEvent(log('GameAccepted', { sessionId:'g1', accepter:'0xB', startedAt:77 }), {
    gameSession: { playerA:'0xA', playerB:'0xB', state:'ACTIVE', startedAt:77 },
    gameNotificationPolicy: gamePolicy(),
  });
  assert.equal(item.kind, 'GAME_INVITE_ACCEPTED');
  assert.equal(item.recipient, '0xa');
  assert.equal(item.metadata.startedAt, 77);
});

test('game move targets the canonical opposing player as turn-ready', () => {
  const [item] = notificationCandidatesForEvent(log('GameMoveCommitted', { sessionId:'g1', moveNumber:4, player:'0xA', moveHash:'0xsecretcommit' }), {
    gameSession: { playerA:'0xA', playerB:'0xB', state:'ACTIVE', nextMoveNumber:5 },
    gameNotificationPolicy: gamePolicy(),
  });
  assert.equal(item.kind, 'GAME_TURN');
  assert.equal(item.recipient, '0xb');
  assert.equal(item.metadata.moveNumber, 4);
  assert.equal(item.metadata.nextMoveNumber, 5);
  assert.equal(Object.hasOwn(item.metadata, 'moveHash'), false);
});

test('game finish notifies the other canonical player without inventing wager state', () => {
  const [item] = notificationCandidatesForEvent(log('GameFinished', { sessionId:'g1', winner:'0xA', actor:'0xA', finishedAt:99 }), {
    gameSession: { playerA:'0xA', playerB:'0xB', state:'FINISHED', winner:'0xA', finishedAt:99 },
    gameNotificationPolicy: gamePolicy(),
  });
  assert.equal(item.kind, 'GAME_FINISHED');
  assert.equal(item.recipient, '0xb');
  assert.equal(item.metadata.winner, '0xA');
  assert.equal(Object.hasOwn(item.metadata, 'wagerAmount'), false);
});

test('game notification policy suppresses blocked, muted and inactive pairs', () => {
  const source = log('GameMoveCommitted', { sessionId:'g1', moveNumber:1, player:'0xA' });
  const session = { playerA:'0xA', playerB:'0xB', state:'ACTIVE', nextMoveNumber:2 };
  assert.deepEqual(notificationCandidatesForEvent(source, { gameSession:session, gameNotificationPolicy:gamePolicy({ blockedEither:true }) }), []);
  assert.deepEqual(notificationCandidatesForEvent(source, { gameSession:session, gameNotificationPolicy:gamePolicy({ notificationsMuted:true }) }), []);
  assert.deepEqual(notificationCandidatesForEvent(source, { gameSession:session, gameNotificationPolicy:gamePolicy({ recipientActive:false }) }), []);
});

test('Messenger envelope notification is metadata-only and never carries envelope/storage commitments', () => {
  const source = log('EnvelopeCommitted', {
    messageId:'m1',
    conversationId:'c1',
    sender:'0xA',
    sequence:8,
    envelopeHash:'0xprivate-envelope-commitment',
    storageRefHash:'0xprivate-storage-ref',
  });
  const [item] = notificationCandidatesForEvent(source, {
    privateContext: { contextId:'ctx1', messengerConversationId:'c1', a:'0xA', b:'0xB', exists:true, closed:false },
    messageNotificationPolicy: messagePolicy(),
  });
  assert.equal(item.kind, 'MESSAGE_RECEIVED');
  assert.equal(item.recipient, '0xb');
  assert.deepEqual(item.metadata, { messageId:'m1', conversationId:'c1', contextId:'ctx1', sequence:8 });
  assert.equal(Object.hasOwn(item.metadata, 'envelopeHash'), false);
  assert.equal(Object.hasOwn(item.metadata, 'storageRefHash'), false);
  const validated = validateBongGogglesNotificationCandidate(item);
  assert.equal(validated.metadataOnly, true);
  assert.equal(validated.privatePayloadForbidden, true);
});

test('Messenger notification requires canonical Bong Goggles context and current send authorization', () => {
  const source = log('EnvelopeCommitted', { messageId:'m1', conversationId:'c1', sender:'0xA', sequence:1 });
  assert.deepEqual(notificationCandidatesForEvent(source, {
    privateContext: { contextId:'ctx1', messengerConversationId:'other', a:'0xA', b:'0xB', exists:true, closed:false },
    messageNotificationPolicy: messagePolicy(),
  }), []);
  assert.deepEqual(notificationCandidatesForEvent(source, {
    privateContext: { contextId:'ctx1', messengerConversationId:'c1', a:'0xA', b:'0xB', exists:true, closed:true },
    messageNotificationPolicy: messagePolicy(),
  }), []);
  assert.deepEqual(notificationCandidatesForEvent(source, {
    privateContext: { contextId:'ctx1', messengerConversationId:'c1', a:'0xA', b:'0xB', exists:true, closed:false },
    messageNotificationPolicy: messagePolicy({ canSend:false }),
  }), []);
});

test('catalog rejects private Messenger payload and commitment fields', () => {
  const source = log('EnvelopeCommitted', { messageId:'m1', conversationId:'c1', sender:'0xA', sequence:1 });
  const [item] = notificationCandidatesForEvent(source, {
    privateContext: { contextId:'ctx1', messengerConversationId:'c1', a:'0xA', b:'0xB', exists:true, closed:false },
    messageNotificationPolicy: messagePolicy(),
  });
  assert.throws(() => validateBongGogglesNotificationCandidate({ ...item, metadata:{ ...item.metadata, ciphertext:'secret' } }), /forbidden/);
  assert.throws(() => validateBongGogglesNotificationCandidate({ ...item, metadata:{ ...item.metadata, envelopeHash:'0xhash' } }), /forbidden/);
});

test('game/message replay remains deterministic through the common pipeline', () => {
  const pipeline = new BongGogglesNotificationPipeline();
  const source = log('EnvelopeCommitted', { messageId:'m1', conversationId:'c1', sender:'0xA', sequence:1 });
  const state = {
    privateContext: { contextId:'ctx1', messengerConversationId:'c1', a:'0xA', b:'0xB', exists:true, closed:false },
    messageNotificationPolicy: messagePolicy(),
  };
  assert.equal(pipeline.process(source, state).length, 1);
  assert.equal(pipeline.process(source, state).length, 0);
});
