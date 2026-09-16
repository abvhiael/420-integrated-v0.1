import {
  profileMutation,
  socialObjectMutation,
  relationshipMutation,
  deleteRelationshipMutation,
} from './materializedViews.js';
import {
  pageMutation,
  groupMutation,
  groupMemberMutation,
  deleteGroupMemberMutation,
  eventMutation,
  rsvpMutation,
  discoverySubjectMutation,
  reviewMutation,
  correctionMutation,
  verificationMutation,
} from './communityDiscoveryReducers.js';

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function lower(value) {
  return required(value, 'address').toLowerCase();
}

function profileFromState(state) {
  const p = required(state?.profile, 'canonical profile state');
  return profileMutation({
    account: required(p.account, 'profile.account'),
    active: p.active === true || p.status === 'ACTIVE',
    profileType: p.profileType ?? null,
    handleHash: p.displayNameHash ?? p.handleHash ?? null,
    metadataHash: p.metadataRoot ?? p.metadataHash ?? null,
  });
}

function socialObjectFromState(state) {
  const o = required(state?.socialObject, 'canonical social object state');
  return socialObjectMutation({
    objectId: required(o.objectId, 'socialObject.objectId'),
    author: required(o.author, 'socialObject.author'),
    objectType: o.objectType ?? null,
    status: o.status ?? null,
    audienceType: o.audienceType ?? null,
    audienceRef: o.audienceRef ?? null,
    parentId: o.parentId ?? null,
    sourceObjectId: o.sourceObjectId ?? null,
    contentHash: o.contentHash ?? null,
    version: Number(o.version ?? 0),
  });
}

function friendPair(state) {
  const r = required(state?.friendRequest, 'canonical friend request state');
  return [lower(required(r.requester, 'friendRequest.requester')), lower(required(r.recipient, 'friendRequest.recipient'))];
}

export const CANONICAL_BONG_GOGGLES_EVENTS = Object.freeze({
  PROFILE: new Set(['ProfileCreated', 'ProfileUpdated', 'ProfileStatusChanged']),
  SOCIAL_OBJECT: new Set(['SocialObjectPublished', 'SocialObjectProvenance', 'SocialObjectEdited', 'SocialObjectHidden', 'SocialObjectRestored', 'SocialObjectDeleted']),
  RELATIONSHIP: new Set(['FriendRequestAccepted', 'FriendshipRemoved', 'Followed', 'Unfollowed', 'Blocked', 'Unblocked', 'Muted', 'Unmuted']),
  COMMUNITY: new Set(['PageCreated', 'PageUpdated', 'GroupCreated', 'GroupUpdated', 'GroupJoinRequested', 'GroupMemberActivated', 'GroupMemberRemoved', 'EventCreated', 'EventUpdated', 'EventRSVP']),
  DISCOVERY: new Set(['SubjectSubmitted', 'ReviewPublished', 'ReviewWithdrawn', 'CorrectionSubmitted', 'VerificationAttested']),
});

/**
 * Convert one decoded canonical Bong Goggles contract event into projector mutations.
 * `state` must be read from the canonical contracts at the event block whenever the
 * event payload itself does not contain the complete materialized record.
 */
export function adaptBongGogglesEvent(decoded, state = {}) {
  const eventName = required(decoded?.eventName, 'eventName');
  const args = decoded?.args ?? {};

  if (CANONICAL_BONG_GOGGLES_EVENTS.PROFILE.has(eventName)) {
    return [profileFromState(state)];
  }

  if (CANONICAL_BONG_GOGGLES_EVENTS.SOCIAL_OBJECT.has(eventName)) {
    if (eventName === 'SocialObjectProvenance') return [];
    return [socialObjectFromState(state)];
  }

  switch (eventName) {
    case 'FriendRequestAccepted': {
      const [a, b] = friendPair(state);
      return [relationshipMutation({ relationshipType: 'FRIEND', from: a, to: b, status: 'ACTIVE' })];
    }
    case 'FriendshipRemoved':
      return [deleteRelationshipMutation({ relationshipType: 'FRIEND', from: lower(args.accountA), to: lower(args.accountB) })];
    case 'Followed':
      return [relationshipMutation({ relationshipType: 'FOLLOW', from: lower(args.follower), to: lower(args.subject), status: 'ACTIVE' })];
    case 'Unfollowed':
      return [deleteRelationshipMutation({ relationshipType: 'FOLLOW', from: lower(args.follower), to: lower(args.subject) })];
    case 'Blocked':
      return [relationshipMutation({ relationshipType: 'BLOCK', from: lower(args.blocker), to: lower(args.subject), status: 'ACTIVE', blocked: true })];
    case 'Unblocked':
      return [deleteRelationshipMutation({ relationshipType: 'BLOCK', from: lower(args.blocker), to: lower(args.subject) })];
    case 'Muted':
      return [relationshipMutation({ relationshipType: 'MUTE', from: lower(args.muter), to: lower(args.subject), status: 'ACTIVE', muted: true })];
    case 'Unmuted':
      return [deleteRelationshipMutation({ relationshipType: 'MUTE', from: lower(args.muter), to: lower(args.subject) })];

    case 'PageCreated':
    case 'PageUpdated':
      return [pageMutation(required(state.page, 'canonical page state'))];
    case 'GroupCreated':
    case 'GroupUpdated':
      return [groupMutation(required(state.group, 'canonical group state'))];
    case 'GroupJoinRequested':
    case 'GroupMemberActivated':
      return [groupMemberMutation(required(args.groupId, 'groupId'), required(args.account, 'account'), required(state.groupMember, 'canonical group member state'))];
    case 'GroupMemberRemoved':
      return [deleteGroupMemberMutation(required(args.groupId, 'groupId'), required(args.account, 'account'))];
    case 'EventCreated':
    case 'EventUpdated':
      return [eventMutation(required(state.eventRecord, 'canonical event state'))];
    case 'EventRSVP':
      return [rsvpMutation(required(args.eventId, 'eventId'), required(args.account, 'account'), required(args.state, 'rsvp state'))];

    case 'SubjectSubmitted':
      return [discoverySubjectMutation(required(state.subject, 'canonical discovery subject state'))];
    case 'ReviewPublished': {
      const mutations = [];
      if (state.previousReview) mutations.push(reviewMutation(state.previousReview));
      mutations.push(reviewMutation(required(state.review, 'canonical review state')));
      return mutations;
    }
    case 'ReviewWithdrawn':
      return [reviewMutation(required(state.review, 'canonical review state'))];
    case 'CorrectionSubmitted':
      return [correctionMutation(required(state.correction, 'canonical correction state'))];
    case 'VerificationAttested':
      return [verificationMutation(required(state.verification, 'canonical verification state'))];
    default:
      throw new Error(`unsupported Bong Goggles event: ${eventName}`);
  }
}

export function toProjectorEvent(log, state = {}) {
  const mutations = adaptBongGogglesEvent(log, state);
  return {
    chainId: required(log.chainId, 'chainId'),
    blockNumber: required(log.blockNumber, 'blockNumber'),
    blockHash: required(log.blockHash, 'blockHash'),
    transactionIndex: required(log.transactionIndex, 'transactionIndex'),
    transactionHash: required(log.transactionHash, 'transactionHash'),
    logIndex: required(log.logIndex, 'logIndex'),
    eventName: required(log.eventName, 'eventName'),
    mutations,
  };
}
