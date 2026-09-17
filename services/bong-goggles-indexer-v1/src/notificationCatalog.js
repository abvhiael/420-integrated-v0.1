const CATALOG = Object.freeze({
  FRIEND_REQUEST_RECEIVED: { topic: 'relationships', severity: 'info', actionable: true },
  FRIEND_ACCEPTED: { topic: 'relationships', severity: 'info', actionable: true },
  FOLLOWED: { topic: 'relationships', severity: 'info', actionable: true },
  BLOCKED: { topic: 'safety', severity: 'warning', actionable: false },

  COMMENT_CREATED: { topic: 'interactions', severity: 'info', actionable: true },
  MENTIONED: { topic: 'interactions', severity: 'info', actionable: true },
  TAGGED: { topic: 'interactions', severity: 'info', actionable: true },

  GROUP_JOIN_REQUESTED: { topic: 'groups', severity: 'info', actionable: true },
  GROUP_MEMBER_ACTIVATED: { topic: 'groups', severity: 'info', actionable: true },
  GROUP_MEMBER_REMOVED: { topic: 'groups', severity: 'warning', actionable: true },
  GROUP_ACTIVITY: { topic: 'groups', severity: 'info', actionable: true },

  EVENT_RSVP: { topic: 'events', severity: 'info', actionable: true },
  EVENT_ACTIVITY: { topic: 'events', severity: 'info', actionable: true },

  GAME_INVITE: { topic: 'games', severity: 'info', actionable: true },
  GAME_INVITE_ACCEPTED: { topic: 'games', severity: 'info', actionable: true },
  GAME_TURN: { topic: 'games', severity: 'info', actionable: true },
  GAME_FINISHED: { topic: 'games', severity: 'info', actionable: true },

  MESSAGE_RECEIVED: {
    topic: 'messages',
    severity: 'info',
    actionable: true,
    metadataOnly: true,
    privatePayloadForbidden: true,
  },

  MODERATION_ACTION: { topic: 'moderation', severity: 'warning', actionable: true },
  APPEAL_UPDATED: { topic: 'moderation', severity: 'info', actionable: true },
  REWARD_EARNED: { topic: 'rewards', severity: 'info', actionable: true },

  REVIEW_PUBLISHED: { topic: 'discovery', severity: 'info', actionable: true },
  CORRECTION_SUBMITTED: { topic: 'discovery', severity: 'info', actionable: true },
  VERIFICATION_ATTESTED: { topic: 'discovery', severity: 'info', actionable: true },
});

export const BONG_GOGGLES_NOTIFICATION_KINDS = Object.freeze(Object.keys(CATALOG));

export function bongGogglesNotificationDescriptor(kind) {
  const descriptor = CATALOG[kind];
  if (!descriptor) throw new Error(`unsupported Bong Goggles notification kind: ${kind}`);
  return Object.freeze({ kind, ...descriptor });
}

export function bongGogglesNotificationTopics() {
  return Object.freeze([...new Set(Object.values(CATALOG).map((item) => item.topic))].sort());
}

export function validateBongGogglesNotificationCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') throw new Error('notification candidate required');
  if (candidate.serviceId !== '420/service/notifications/v1') throw new Error('invalid notification service');
  if (candidate.appId !== 'bong-goggles') throw new Error('invalid notification app');
  if (candidate.authoritative !== false) throw new Error('notification candidate must be non-authoritative');
  if (!candidate.notificationId) throw new Error('notificationId required');
  if (!candidate.recipient) throw new Error('recipient required');
  if (!candidate.provenance || !candidate.provenance.transactionHash) throw new Error('provenance required');

  const descriptor = bongGogglesNotificationDescriptor(candidate.kind);
  if (candidate.topic !== descriptor.topic) throw new Error('notification topic does not match catalog');

  return {
    ...candidate,
    severity: descriptor.severity,
    actionable: descriptor.actionable,
    metadataOnly: descriptor.metadataOnly === true,
    privatePayloadForbidden: descriptor.privatePayloadForbidden === true,
    authoritative: false,
  };
}
