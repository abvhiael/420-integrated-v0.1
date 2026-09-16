function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function lower(value) { return required(value, 'address').toLowerCase(); }

function upsert(entityType, entityId, value) {
  return { entityType, entityId: required(entityId, `${entityType}.id`), operation: 'UPSERT', value };
}

function del(entityType, entityId) {
  return { entityType, entityId: required(entityId, `${entityType}.id`), operation: 'DELETE' };
}

export function pageMutation(page) {
  const p = required(page, 'canonical page state');
  return upsert('page', required(p.pageId, 'page.pageId'), {
    pageId: p.pageId,
    profileAccount: lower(p.profileAccount),
    owner: lower(p.owner),
    metadataRoot: p.metadataRoot ?? null,
    active: p.active === true,
    exists: p.exists !== false,
    createdAt: Number(p.createdAt ?? 0),
    updatedAt: Number(p.updatedAt ?? 0),
  });
}

export function groupMutation(group) {
  const g = required(group, 'canonical group state');
  return upsert('group', required(g.groupId, 'group.groupId'), {
    groupId: g.groupId,
    owner: lower(g.owner),
    privacy: g.privacy ?? null,
    joinPolicy: g.joinPolicy ?? null,
    metadataRoot: g.metadataRoot ?? null,
    active: g.active === true,
    exists: g.exists !== false,
    createdAt: Number(g.createdAt ?? 0),
    updatedAt: Number(g.updatedAt ?? 0),
  });
}

export function groupMemberMutation(groupId, account, member) {
  const m = required(member, 'canonical group member state');
  const normalized = lower(account);
  return upsert('groupMember', `${required(groupId, 'groupId')}:${normalized}`, {
    groupId,
    account: normalized,
    state: m.state ?? null,
    role: m.role ?? null,
    joinedAt: Number(m.joinedAt ?? 0),
    updatedAt: Number(m.updatedAt ?? 0),
  });
}

export function deleteGroupMemberMutation(groupId, account) {
  return del('groupMember', `${required(groupId, 'groupId')}:${lower(account)}`);
}

export function eventMutation(eventRecord) {
  const e = required(eventRecord, 'canonical event state');
  return upsert('event', required(e.eventId, 'event.eventId'), {
    eventId: e.eventId,
    owner: lower(e.owner),
    hostType: e.hostType ?? null,
    hostAccount: e.hostAccount ? lower(e.hostAccount) : null,
    hostId: e.hostId ?? null,
    visibility: e.visibility ?? null,
    metadataRoot: e.metadataRoot ?? null,
    startsAt: Number(e.startsAt ?? 0),
    endsAt: Number(e.endsAt ?? 0),
    active: e.active === true,
    exists: e.exists !== false,
    createdAt: Number(e.createdAt ?? 0),
    updatedAt: Number(e.updatedAt ?? 0),
  });
}

export function rsvpMutation(eventId, account, state) {
  const normalized = lower(account);
  return upsert('eventRsvp', `${required(eventId, 'eventId')}:${normalized}`, {
    eventId,
    account: normalized,
    state: required(state, 'rsvp.state'),
  });
}

export function discoverySubjectMutation(subject) {
  const s = required(subject, 'canonical discovery subject state');
  return upsert('discoverySubject', required(s.subjectId, 'subject.subjectId'), {
    subjectId: s.subjectId,
    subjectType: s.subjectType ?? null,
    canonicalRef: s.canonicalRef ?? null,
    metadataRoot: s.metadataRoot ?? null,
    locationCommitment: s.locationCommitment ?? null,
    locationPrecision: s.locationPrecision ?? null,
    submitter: lower(s.submitter),
    createdAt: Number(s.createdAt ?? 0),
    status: s.status ?? null,
    exists: s.exists !== false,
  });
}

export function reviewMutation(review) {
  const r = required(review, 'canonical review state');
  return upsert('review', required(r.reviewId, 'review.reviewId'), {
    reviewId: r.reviewId,
    subjectId: required(r.subjectId, 'review.subjectId'),
    author: lower(r.author),
    contentHash: r.contentHash ?? null,
    ratingBps: Number(r.ratingBps ?? 0),
    version: Number(r.version ?? 0),
    active: r.active === true,
    updatedAt: Number(r.updatedAt ?? 0),
  });
}

export function correctionMutation(correction) {
  const c = required(correction, 'canonical correction state');
  return upsert('discoveryCorrection', required(c.correctionId, 'correction.correctionId'), {
    correctionId: c.correctionId,
    subjectId: required(c.subjectId, 'correction.subjectId'),
    author: lower(c.author),
    fieldId: c.fieldId ?? null,
    proposedValueHash: c.proposedValueHash ?? null,
    evidenceHash: c.evidenceHash ?? null,
    createdAt: Number(c.createdAt ?? 0),
  });
}

export function verificationMutation(verification) {
  const v = required(verification, 'canonical verification state');
  return upsert('discoveryVerification', required(v.verificationId, 'verification.verificationId'), {
    verificationId: v.verificationId,
    subjectId: required(v.subjectId, 'verification.subjectId'),
    verifier: lower(v.verifier),
    propositionHash: v.propositionHash ?? null,
    subjectVersion: Number(v.subjectVersion ?? 0),
    supportsProposition: v.supportsProposition === true,
    evidenceHash: v.evidenceHash ?? null,
    createdAt: Number(v.createdAt ?? 0),
  });
}
