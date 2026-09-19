import { MAX_STALE_SECONDS, validateSnapshot, validateStreamEvent } from './exchange-client.js';

export function createExchangeStore() {
  return {
    snapshots: new Map(),
    records: new Map(),
    canonicality: new Map(),
    replacements: new Map(),
    lastSequence: 0,
    resumeCursor: '',
    canonicalHead: 0,
    latestEmittedAt: 0,
    freshness: 'degraded',
  };
}

export function applySnapshot(store, snapshot) {
  validateSnapshot(snapshot);
  const current = store.snapshots.get(snapshot.marketSubjectId);
  if (current && current.snapshotId === snapshot.snapshotId) return store;
  store.snapshots.set(snapshot.marketSubjectId, snapshot);
  store.canonicality.set(snapshot.snapshotId, snapshot.canonicality);
  store.canonicalHead = Math.max(store.canonicalHead, snapshot.canonicalHead);
  return store;
}

export function applyHistoryPage(store, page) {
  for (const record of page.records) {
    store.records.set(record.recordId, record);
    store.canonicality.set(record.recordId, record.active ? 'canonical' : 'reorg');
  }
  store.resumeCursor = page.nextCursor || store.resumeCursor;
  return store;
}

export function applyStreamEvent(store, event) {
  validateStreamEvent(event);
  if (event.sequence <= store.lastSequence) return store;
  if (store.lastSequence && event.sequence !== store.lastSequence + 1) {
    throw new Error('stream sequence gap');
  }

  store.lastSequence = event.sequence;
  store.resumeCursor = String(event.sequence);
  store.canonicalHead = Math.max(store.canonicalHead, event.canonicalHead);
  store.latestEmittedAt = Math.max(store.latestEmittedAt, event.emittedAt ?? 0);

  if (event.kind === 'DATA' && event.recordId) {
    store.canonicality.set(event.recordId, 'canonical');
  } else if (event.kind === 'REORG') {
    store.canonicality.set(event.affectedRecordId, 'reorg');
  } else if (event.kind === 'REPLACEMENT') {
    store.canonicality.set(event.affectedRecordId, 'reorg');
    store.canonicality.set(event.replacementRecordId, 'replacement');
    store.replacements.set(event.affectedRecordId, event.replacementRecordId);
  }
  return store;
}

export function updateFreshness(store, nowSeconds) {
  if (!store.latestEmittedAt || nowSeconds < store.latestEmittedAt) {
    store.freshness = 'degraded';
    return store.freshness;
  }
  store.freshness = nowSeconds - store.latestEmittedAt > MAX_STALE_SECONDS ? 'stale' : 'canonical';
  return store.freshness;
}
