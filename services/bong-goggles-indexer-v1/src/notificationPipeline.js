import { digest } from './projector.js';

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function lower(value) {
  return required(value, 'address').toLowerCase();
}

function sourceKey(log) {
  return `${required(log.chainId, 'chainId')}:${required(log.blockNumber, 'blockNumber')}:${required(log.transactionIndex, 'transactionIndex')}:${required(log.logIndex, 'logIndex')}`;
}

function candidate(log, { recipient, actor = null, kind, topic, subjectId = null, metadata = {} }) {
  const normalizedRecipient = lower(recipient);
  const normalizedActor = actor ? lower(actor) : null;
  if (normalizedActor && normalizedActor === normalizedRecipient) return null;
  const provenance = {
    chainId: log.chainId,
    blockNumber: log.blockNumber,
    blockHash: required(log.blockHash, 'blockHash'),
    transactionHash: required(log.transactionHash, 'transactionHash'),
    transactionIndex: log.transactionIndex,
    logIndex: log.logIndex,
    eventName: required(log.eventName, 'eventName'),
  };
  const envelope = {
    serviceId: '420/service/notifications/v1',
    appId: 'bong-goggles',
    authoritative: false,
    sourceKey: sourceKey(log),
    recipient: normalizedRecipient,
    actor: normalizedActor,
    kind,
    topic,
    subjectId,
    metadata,
    provenance,
  };
  return { ...envelope, notificationId: digest(envelope) };
}

function qualifiedInteraction(state, { mention = false } = {}) {
  const policy = required(state.notificationPolicy, 'canonical notification policy state');
  if (policy.actorActive !== true || policy.recipientActive !== true) return false;
  if (policy.blockedEither === true || policy.notificationsMuted === true) return false;
  if (policy.canInteract !== true) return false;
  if (mention && policy.canMention !== true) return false;
  return true;
}

function qualifiedGame(state, { invite = false } = {}) {
  const policy = required(state.gameNotificationPolicy, 'canonical game notification policy state');
  if (policy.actorActive !== true || policy.recipientActive !== true) return false;
  if (policy.blockedEither === true || policy.notificationsMuted === true || policy.gameInvitesMuted === true) return false;
  if (policy.zeroWager !== true) return false;
  if (invite && policy.canInviteToGame !== true) return false;
  return true;
}

function qualifiedMessage(state) {
  const policy = required(state.messageNotificationPolicy, 'canonical message notification policy state');
  if (policy.senderActive !== true || policy.recipientActive !== true) return false;
  if (policy.blockedEither === true || policy.notificationsMuted === true) return false;
  if (policy.conversationActive !== true || policy.canSend !== true) return false;
  return true;
}

function recipientAllowed(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (!entry.account) return false;
  if (entry.active === false || entry.notificationsMuted === true || entry.blockedEither === true) return false;
  return true;
}

function activeRecord(record) {
  if (!record || record.exists === false || record.active === false) return false;
  return true;
}

function isCommentType(value) {
  return value === 3 || value === 'COMMENT';
}

function isProfileTag(value) {
  return value === 0 || value === 'PROFILE';
}

function isActiveMember(value) {
  return value === 2 || value === 'ACTIVE';
}

function isRemovedMember(value) {
  return value === 3 || value === 'REMOVED';
}

function isInvitedGame(value) {
  return value === 1 || value === 'INVITED';
}

function isActiveGame(value) {
  return value === 2 || value === 'ACTIVE';
}

function isFinishedGame(value) {
  return value === 3 || value === 'FINISHED';
}

function gamePeer(session, actor) {
  const normalizedActor = lower(actor);
  if (lower(session.playerA) === normalizedActor) return session.playerB;
  if (lower(session.playerB) === normalizedActor) return session.playerA;
  throw new Error('game actor is not a canonical session player');
}

function directMessagePeer(context, sender) {
  const normalizedSender = lower(sender);
  if (lower(context.a) === normalizedSender) return context.b;
  if (lower(context.b) === normalizedSender) return context.a;
  throw new Error('message sender is not a canonical direct-context participant');
}

export function notificationCandidatesForEvent(log, state = {}) {
  const eventName = required(log?.eventName, 'eventName');
  const args = log.args ?? {};
  const out = [];
  const add = (entry) => { if (entry) out.push(entry); };

  switch (eventName) {
    case 'FriendRequestCreated':
      if (qualifiedInteraction(state)) {
        add(candidate(log, { recipient: args.recipient, actor: args.requester, kind: 'FRIEND_REQUEST_RECEIVED', topic: 'relationships', subjectId: args.requestId ?? null }));
      }
      break;
    case 'FriendRequestAccepted': {
      const request = required(state.friendRequest, 'canonical friend request state');
      add(candidate(log, { recipient: request.requester, actor: request.recipient, kind: 'FRIEND_ACCEPTED', topic: 'relationships', subjectId: args.requestId ?? null }));
      break;
    }
    case 'FollowRequestCreated':
      if (qualifiedInteraction(state)) {
        add(candidate(log, { recipient: args.subject, actor: args.follower, kind: 'FOLLOW_REQUEST_RECEIVED', topic: 'relationships', subjectId: args.requestId ?? null }));
      }
      break;
    case 'Followed':
      add(candidate(log, { recipient: args.subject, actor: args.follower, kind: 'FOLLOWED', topic: 'relationships' }));
      break;
    case 'Blocked':
      add(candidate(log, { recipient: args.subject, actor: args.blocker, kind: 'BLOCKED', topic: 'safety' }));
      break;
    case 'SocialObjectPublished': {
      const object = required(state.socialObject, 'canonical social object state');
      if (!isCommentType(args.objectType ?? object.objectType)) break;
      const parent = required(state.parentObject, 'canonical parent social object state');
      if (object.status !== undefined && object.status !== 0 && object.status !== 'ACTIVE') break;
      if (parent.status !== undefined && parent.status !== 0 && parent.status !== 'ACTIVE') break;
      if (!qualifiedInteraction(state)) break;
      add(candidate(log, {
        recipient: parent.author,
        actor: args.author ?? object.author,
        kind: 'COMMENT_CREATED',
        topic: 'interactions',
        subjectId: args.objectId ?? object.objectId ?? null,
        metadata: { parentId: args.parentId ?? object.parentId ?? null, rootId: object.rootId ?? null },
      }));
      break;
    }
    case 'TagCreated': {
      const mention = isProfileTag(args.targetType);
      if (!qualifiedInteraction(state, { mention })) break;
      add(candidate(log, {
        recipient: args.target,
        actor: args.objectAuthor,
        kind: mention ? 'MENTIONED' : 'TAGGED',
        topic: 'interactions',
        subjectId: args.objectId ?? null,
        metadata: { tagId: args.tagId ?? null, targetType: args.targetType ?? null, tagState: args.state ?? null },
      }));
      break;
    }
    case 'GroupJoinRequested': {
      const group = required(state.group, 'canonical group state');
      if (!activeRecord(group)) break;
      add(candidate(log, { recipient: group.owner, actor: args.account, kind: 'GROUP_JOIN_REQUESTED', topic: 'groups', subjectId: args.groupId }));
      break;
    }
    case 'GroupMemberActivated': {
      const group = required(state.group, 'canonical group state');
      const member = required(state.groupMember, 'canonical group member state');
      if (!activeRecord(group) || !isActiveMember(member.state)) break;
      add(candidate(log, { recipient: args.account, actor: group.owner, kind: 'GROUP_MEMBER_ACTIVATED', topic: 'groups', subjectId: args.groupId, metadata: { role: args.role ?? member.role ?? null } }));
      break;
    }
    case 'GroupMemberRemoved': {
      const group = required(state.group, 'canonical group state');
      const member = required(state.groupMember, 'canonical group member state');
      if (!isRemovedMember(member.state)) break;
      add(candidate(log, { recipient: args.account, actor: null, kind: 'GROUP_MEMBER_REMOVED', topic: 'groups', subjectId: args.groupId, metadata: { groupOwner: group.owner ?? null } }));
      break;
    }
    case 'GroupUpdated': {
      const group = required(state.group, 'canonical group state');
      if (group.exists === false) break;
      const recipients = required(state.groupNotificationRecipients, 'canonical group notification recipients');
      if (!Array.isArray(recipients)) throw new Error('invalid canonical group notification recipients');
      for (const recipient of recipients) {
        if (!recipientAllowed(recipient)) continue;
        add(candidate(log, {
          recipient: recipient.account,
          actor: group.owner,
          kind: 'GROUP_ACTIVITY',
          topic: 'groups',
          subjectId: args.groupId,
          metadata: { privacy: args.privacy ?? group.privacy ?? null, joinPolicy: args.joinPolicy ?? group.joinPolicy ?? null, active: args.active ?? group.active ?? null },
        }));
      }
      break;
    }
    case 'EventRSVP': {
      const eventRecord = required(state.eventRecord, 'canonical event state');
      if (!activeRecord(eventRecord)) break;
      add(candidate(log, { recipient: eventRecord.owner, actor: args.account, kind: 'EVENT_RSVP', topic: 'events', subjectId: args.eventId, metadata: { state: args.state ?? null } }));
      break;
    }
    case 'EventUpdated': {
      const eventRecord = required(state.eventRecord, 'canonical event state');
      if (eventRecord.exists === false) break;
      const recipients = required(state.eventNotificationRecipients, 'canonical event notification recipients');
      if (!Array.isArray(recipients)) throw new Error('invalid canonical event notification recipients');
      for (const recipient of recipients) {
        if (!recipientAllowed(recipient)) continue;
        add(candidate(log, {
          recipient: recipient.account,
          actor: eventRecord.owner,
          kind: 'EVENT_ACTIVITY',
          topic: 'events',
          subjectId: args.eventId,
          metadata: { startsAt: args.startsAt ?? eventRecord.startsAt ?? null, endsAt: args.endsAt ?? eventRecord.endsAt ?? null, active: args.active ?? eventRecord.active ?? null },
        }));
      }
      break;
    }
    case 'GameInvited': {
      const session = required(state.gameSession, 'canonical game session state');
      if (!isInvitedGame(session.state) || !qualifiedGame(state, { invite: true })) break;
      add(candidate(log, {
        recipient: args.recipient,
        actor: args.inviter,
        kind: 'GAME_INVITE',
        topic: 'games',
        subjectId: args.sessionId,
        metadata: { gameType: args.gameType ?? session.gameType ?? null, rulesetHash: args.rulesetHash ?? session.rulesetHash ?? null },
      }));
      break;
    }
    case 'GameAccepted': {
      const session = required(state.gameSession, 'canonical game session state');
      if (!isActiveGame(session.state) || !qualifiedGame(state)) break;
      add(candidate(log, {
        recipient: session.playerA,
        actor: args.accepter,
        kind: 'GAME_INVITE_ACCEPTED',
        topic: 'games',
        subjectId: args.sessionId,
        metadata: { startedAt: args.startedAt ?? session.startedAt ?? null },
      }));
      break;
    }
    case 'GameMoveCommitted': {
      const session = required(state.gameSession, 'canonical game session state');
      if (!isActiveGame(session.state) || !qualifiedGame(state)) break;
      const recipient = gamePeer(session, args.player);
      add(candidate(log, {
        recipient,
        actor: args.player,
        kind: 'GAME_TURN',
        topic: 'games',
        subjectId: args.sessionId,
        metadata: { moveNumber: args.moveNumber ?? null, nextMoveNumber: session.nextMoveNumber ?? null },
      }));
      break;
    }
    case 'GameFinished': {
      const session = required(state.gameSession, 'canonical game session state');
      if (!isFinishedGame(session.state) || !qualifiedGame(state)) break;
      const recipient = gamePeer(session, args.actor);
      add(candidate(log, {
        recipient,
        actor: args.actor,
        kind: 'GAME_FINISHED',
        topic: 'games',
        subjectId: args.sessionId,
        metadata: { winner: args.winner ?? session.winner ?? null, finishedAt: args.finishedAt ?? session.finishedAt ?? null },
      }));
      break;
    }
    case 'EnvelopeCommitted': {
      const context = required(state.privateContext, 'canonical Bong Goggles private context state');
      if (context.exists === false || context.closed === true) break;
      if (context.messengerConversationId !== args.conversationId) break;
      if (!qualifiedMessage(state)) break;
      const recipient = directMessagePeer(context, args.sender);
      add(candidate(log, {
        recipient,
        actor: args.sender,
        kind: 'MESSAGE_RECEIVED',
        topic: 'messages',
        subjectId: args.conversationId,
        metadata: {
          messageId: args.messageId ?? null,
          conversationId: args.conversationId ?? null,
          contextId: context.contextId ?? null,
          sequence: args.sequence ?? null,
        },
      }));
      break;
    }
    case 'ReviewPublished': {
      const subject = required(state.subject, 'canonical discovery subject state');
      add(candidate(log, { recipient: subject.submitter, actor: args.author, kind: 'REVIEW_PUBLISHED', topic: 'discovery', subjectId: args.subjectId, metadata: { reviewId: args.reviewId ?? null, ratingBps: args.ratingBps ?? null } }));
      break;
    }
    case 'CorrectionSubmitted': {
      const subject = required(state.subject, 'canonical discovery subject state');
      add(candidate(log, { recipient: subject.submitter, actor: args.author, kind: 'CORRECTION_SUBMITTED', topic: 'discovery', subjectId: args.subjectId, metadata: { correctionId: args.correctionId ?? null } }));
      break;
    }
    case 'VerificationAttested': {
      const subject = required(state.subject, 'canonical discovery subject state');
      add(candidate(log, { recipient: subject.submitter, actor: args.verifier, kind: 'VERIFICATION_ATTESTED', topic: 'discovery', subjectId: args.subjectId, metadata: { verificationId: args.verificationId ?? null, supportsProposition: args.supportsProposition === true } }));
      break;
    }
    default:
      return [];
  }

  return out;
}

export class BongGogglesNotificationPipeline {
  constructor() {
    this.delivered = new Set();
    this.checkpoint = null;
  }

  process(log, state = {}) {
    const candidates = notificationCandidatesForEvent(log, state);
    const emitted = [];
    for (const item of candidates) {
      if (this.delivered.has(item.notificationId)) continue;
      this.delivered.add(item.notificationId);
      emitted.push(item);
    }
    this.checkpoint = {
      sourceKey: sourceKey(log),
      chainId: log.chainId,
      blockNumber: log.blockNumber,
      blockHash: log.blockHash,
      authoritative: false,
    };
    return emitted;
  }

  snapshot() {
    return {
      checkpoint: this.checkpoint ? { ...this.checkpoint } : null,
      deliveredIds: [...this.delivered].sort(),
      authoritative: false,
    };
  }

  restore(snapshot) {
    if (!snapshot || snapshot.authoritative !== false) throw new Error('invalid notification snapshot');
    if (!Array.isArray(snapshot.deliveredIds)) throw new Error('invalid notification deliveredIds');
    this.delivered = new Set(snapshot.deliveredIds);
    this.checkpoint = snapshot.checkpoint ? { ...snapshot.checkpoint, authoritative: false } : null;
  }

  canonicalUpdate({ kind, eventNotificationIds = [], replacementNotificationIds = [] }) {
    if (!['finalized', 'retracted', 'superseded'].includes(kind)) throw new Error('invalid canonical update');
    return {
      kind,
      eventNotificationIds: [...eventNotificationIds].sort(),
      replacementNotificationIds: [...replacementNotificationIds].sort(),
      authoritative: false,
    };
  }
}
