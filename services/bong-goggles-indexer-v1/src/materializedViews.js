import { digest } from './projector.js';

function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`invalid ${field}`);
  return value;
}

function bool(value) {
  return value === true;
}

export function profileMutation({ account, active, profileType, handleHash, metadataHash }) {
  requireString(account, 'account');
  return {
    entityType: 'profile',
    entityId: account.toLowerCase(),
    operation: 'UPSERT',
    value: {
      account: account.toLowerCase(),
      active: bool(active),
      profileType: profileType ?? null,
      handleHash: handleHash ?? null,
      metadataHash: metadataHash ?? null,
    },
  };
}

export function socialObjectMutation({ objectId, author, objectType, status, audienceType, audienceRef, parentId, sourceObjectId, contentHash, version }) {
  requireString(objectId, 'objectId');
  requireString(author, 'author');
  return {
    entityType: 'socialObject',
    entityId: objectId,
    operation: 'UPSERT',
    value: {
      objectId,
      author: author.toLowerCase(),
      objectType,
      status,
      audienceType,
      audienceRef: audienceRef ?? null,
      parentId: parentId ?? null,
      sourceObjectId: sourceObjectId ?? null,
      contentHash: contentHash ?? null,
      version: Number.isSafeInteger(version) ? version : 0,
    },
  };
}

export function relationshipMutation({ relationshipType, from, to, status, muted = false, blocked = false }) {
  requireString(relationshipType, 'relationshipType');
  requireString(from, 'from');
  requireString(to, 'to');
  const a = from.toLowerCase();
  const b = to.toLowerCase();
  return {
    entityType: 'relationship',
    entityId: `${relationshipType}:${a}:${b}`,
    operation: 'UPSERT',
    value: {
      relationshipType,
      from: a,
      to: b,
      status,
      muted: bool(muted),
      blocked: bool(blocked),
    },
  };
}

export function deleteRelationshipMutation({ relationshipType, from, to }) {
  requireString(relationshipType, 'relationshipType');
  requireString(from, 'from');
  requireString(to, 'to');
  return {
    entityType: 'relationship',
    entityId: `${relationshipType}:${from.toLowerCase()}:${to.toLowerCase()}`,
    operation: 'DELETE',
  };
}

export function feedEntryMutation({ feedClass, viewerKey = '*', objectId, rankKey, eligible = true, label = 'ORGANIC' }) {
  requireString(feedClass, 'feedClass');
  requireString(objectId, 'objectId');
  return {
    entityType: 'feedEntry',
    entityId: `${feedClass}:${viewerKey.toLowerCase?.() ?? viewerKey}:${objectId}`,
    operation: eligible ? 'UPSERT' : 'DELETE',
    ...(eligible ? {
      value: {
        feedClass,
        viewerKey: viewerKey.toLowerCase?.() ?? viewerKey,
        objectId,
        rankKey: rankKey ?? null,
        label,
      },
    } : {}),
  };
}

export function materializeState(projector) {
  const state = projector.exportState();
  const profiles = new Map();
  const socialObjects = new Map();
  const relationships = [];
  const feeds = new Map();

  for (const entity of state) {
    if (entity.entityType === 'profile') profiles.set(entity.entityId, entity.value);
    if (entity.entityType === 'socialObject') socialObjects.set(entity.entityId, entity.value);
    if (entity.entityType === 'relationship') relationships.push(entity.value);
    if (entity.entityType === 'feedEntry') {
      const key = `${entity.value.feedClass}:${entity.value.viewerKey}`;
      if (!feeds.has(key)) feeds.set(key, []);
      feeds.get(key).push(entity.value);
    }
  }

  for (const entries of feeds.values()) {
    entries.sort((a, b) => {
      const ar = a.rankKey ?? '';
      const br = b.rankKey ?? '';
      return br.localeCompare(ar) || a.objectId.localeCompare(b.objectId);
    });
  }

  const snapshot = projector.snapshot();
  return {
    checkpoint: {
      schemaHash: snapshot.schemaHash,
      chainId: snapshot.chainId,
      indexedBlock: snapshot.indexedBlock,
      indexedBlockHash: snapshot.indexedBlockHash,
      stateRoot: snapshot.stateRoot,
    },
    profiles,
    socialObjects,
    relationships,
    feeds,
    viewDigest: digest({
      checkpoint: snapshot,
      profiles: [...profiles.entries()],
      socialObjects: [...socialObjects.entries()],
      relationships,
      feeds: [...feeds.entries()],
    }),
  };
}

export function visibleFeed(view, { feedClass, viewerKey = '*', limit = 50 }) {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error('invalid limit');
  const key = `${feedClass}:${viewerKey.toLowerCase?.() ?? viewerKey}`;
  const entries = view.feeds.get(key) ?? [];
  const result = [];

  for (const entry of entries) {
    const object = view.socialObjects.get(entry.objectId);
    if (!object) continue;
    const author = view.profiles.get(object.author);
    if (!author?.active) continue;
    if (object.status !== 'ACTIVE') continue;
    result.push({ ...entry, object });
    if (result.length === limit) break;
  }
  return result;
}
