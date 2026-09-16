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

export function notificationCandidatesForEvent(log, state = {}) {
  const eventName = required(log?.eventName, 'eventName');
  const args = log.args ?? {};
  const out = [];
  const add = (entry) => { if (entry) out.push(entry); };

  switch (eventName) {
    case 'FriendRequestAccepted': {
      const request = required(state.friendRequest, 'canonical friend request state');
      add(candidate(log, { recipient: request.requester, actor: request.recipient, kind: 'FRIEND_ACCEPTED', topic: 'relationships', subjectId: args.requestId ?? null }));
      break;
    }
    case 'Followed':
      add(candidate(log, { recipient: args.subject, actor: args.follower, kind: 'FOLLOWED', topic: 'relationships' }));
      break;
    case 'Blocked':
      add(candidate(log, { recipient: args.subject, actor: args.blocker, kind: 'BLOCKED', topic: 'safety' }));
      break;
    case 'GroupJoinRequested': {
      const group = required(state.group, 'canonical group state');
      add(candidate(log, { recipient: group.owner, actor: args.account, kind: 'GROUP_JOIN_REQUESTED', topic: 'groups', subjectId: args.groupId }));
      break;
    }
    case 'GroupMemberActivated':
      add(candidate(log, { recipient: args.account, actor: state.group?.owner ?? null, kind: 'GROUP_MEMBER_ACTIVATED', topic: 'groups', subjectId: args.groupId }));
      break;
    case 'GroupMemberRemoved':
      add(candidate(log, { recipient: args.account, actor: state.group?.owner ?? null, kind: 'GROUP_MEMBER_REMOVED', topic: 'groups', subjectId: args.groupId }));
      break;
    case 'EventRSVP': {
      const eventRecord = required(state.eventRecord, 'canonical event state');
      add(candidate(log, { recipient: eventRecord.owner, actor: args.account, kind: 'EVENT_RSVP', topic: 'events', subjectId: args.eventId, metadata: { state: args.state ?? null } }));
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
