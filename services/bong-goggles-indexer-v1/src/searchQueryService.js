import { digest } from './projector.js';

export const SEARCH_CLASSES = Object.freeze([
  'PEOPLE','PAGES','GROUPS','POSTS','PLACES','PRODUCTS','BRANDS','EVENTS','RESOURCES','COLLECTIONS','GAMES',
]);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function matchesQuery(candidate, query) {
  const q = normalizeText(query);
  if (!q) return true;
  const haystack = normalizeText([
    candidate.entityId,
    candidate.value?.account,
    candidate.value?.handleHash,
    candidate.value?.metadataHash,
    candidate.value?.metadataRoot,
    candidate.value?.contentHash,
    candidate.value?.canonicalRef,
    candidate.value?.subjectType,
  ].filter(Boolean).join(' '));
  return haystack.includes(q);
}

function classify(entity) {
  const type = entity.entityType;
  const value = entity.value ?? {};
  if (type === 'profile') return 'PEOPLE';
  if (type === 'page') return 'PAGES';
  if (type === 'group') return 'GROUPS';
  if (type === 'event') return 'EVENTS';
  if (type === 'socialObject') return value.objectType === 'COLLECTION' ? 'COLLECTIONS' : 'POSTS';
  if (type === 'discoverySubject') {
    const mapping = { PLACE:'PLACES', PRODUCT:'PRODUCTS', BRAND:'BRANDS', EVENT:'EVENTS', RESOURCE:'RESOURCES' };
    return mapping[value.subjectType] ?? null;
  }
  return null;
}

function defaultRank(candidate, query) {
  const q = normalizeText(query);
  const id = normalizeText(candidate.entityId);
  const exact = q && id === q ? 1 : 0;
  const prefix = q && id.startsWith(q) ? 1 : 0;
  const updatedAt = Number(candidate.value?.updatedAt ?? candidate.value?.createdAt ?? 0);
  return { exact, prefix, updatedAt, id };
}

function compareRank(a, b) {
  return b.rank.exact - a.rank.exact
    || b.rank.prefix - a.rank.prefix
    || b.rank.updatedAt - a.rank.updatedAt
    || a.rank.id.localeCompare(b.rank.id);
}

function candidateId(entity) {
  return `${entity.entityType}:${entity.entityId}`;
}

export class BongGogglesSearchQueryService {
  constructor({ projector, canonicalEligibility, canonicalCursorDigest, canonicalRecommendationDigest, clock = () => Date.now() }) {
    this.projector = required(projector, 'projector');
    if (typeof canonicalEligibility !== 'function') throw new Error('canonicalEligibility required');
    this.canonicalEligibility = canonicalEligibility;
    this.canonicalCursorDigest = canonicalCursorDigest;
    this.canonicalRecommendationDigest = canonicalRecommendationDigest;
    this.clock = clock;
  }

  #candidatePool(searchClass, query) {
    if (!SEARCH_CLASSES.includes(searchClass)) throw new Error('invalid searchClass');
    return this.projector.exportState()
      .filter((entity) => classify(entity) === searchClass)
      .filter((entity) => matchesQuery(entity, query));
  }

  async search({ viewer = null, searchClass, query = '', filtersHash = null, rankerId, position = 0, limit = 20 }) {
    required(rankerId, 'rankerId');
    if (!Number.isSafeInteger(position) || position < 0) throw new Error('invalid position');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid limit');

    const snapshot = this.projector.snapshot();
    const queryHash = digest({ searchClass, query: normalizeText(query) });
    const ranked = this.#candidatePool(searchClass, query)
      .map((entity) => ({ entity, rank: defaultRank(entity, query) }))
      .sort(compareRank);

    const eligible = [];
    for (const item of ranked) {
      const allowed = await this.canonicalEligibility({ viewer, searchClass, candidate: item.entity, snapshotBlock: snapshot.indexedBlock });
      if (allowed === true) eligible.push(item.entity);
    }

    const page = eligible.slice(position, position + limit);
    const nextPosition = position + page.length;
    const hasMore = nextPosition < eligible.length;
    const canonicalCursorDigest = typeof this.canonicalCursorDigest === 'function'
      ? await this.canonicalCursorDigest({ viewer, searchClass, queryHash, filtersHash, snapshotBlock: snapshot.indexedBlock, position: nextPosition, rankerId })
      : null;
    const cursor = this.projector.cursorEnvelope({
      viewer,
      searchClass,
      queryHash,
      filtersHash,
      snapshotBlock: snapshot.indexedBlock,
      position: nextPosition,
      rankerId,
      canonicalCursorDigest,
    });

    return {
      searchClass,
      queryHash,
      snapshotBlock: snapshot.indexedBlock,
      snapshotBlockHash: snapshot.indexedBlockHash,
      results: page,
      hasMore,
      cursor,
      freshness: {
        indexedBlock: snapshot.indexedBlock,
        indexedBlockHash: snapshot.indexedBlockHash,
        observedAt: this.clock(),
      },
    };
  }

  async recommend({ viewer = null, searchClass, surfaceId, modelId, limit = 20, query = '' }) {
    required(surfaceId, 'surfaceId');
    required(modelId, 'modelId');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid limit');

    const snapshot = this.projector.snapshot();
    const pool = this.#candidatePool(searchClass, query)
      .map((entity) => ({ entity, rank: defaultRank(entity, query) }))
      .sort(compareRank);
    const eligible = [];
    for (const item of pool) {
      if (await this.canonicalEligibility({ viewer, searchClass, candidate: item.entity, snapshotBlock: snapshot.indexedBlock }) === true) {
        eligible.push(item.entity);
      }
    }
    const results = eligible.slice(0, limit);
    const candidateSetHash = digest(results.map(candidateId));
    const canonicalRecommendationDigest = typeof this.canonicalRecommendationDigest === 'function'
      ? await this.canonicalRecommendationDigest({ viewer, surfaceId, candidateSetHash, modelId, snapshotBlock: snapshot.indexedBlock })
      : null;

    return {
      searchClass,
      snapshotBlock: snapshot.indexedBlock,
      snapshotBlockHash: snapshot.indexedBlockHash,
      surfaceId,
      modelId,
      candidateSetHash,
      canonicalRecommendationDigest,
      backendDigest: digest({ viewer, searchClass, surfaceId, modelId, candidateSetHash, snapshotBlock: snapshot.indexedBlock }),
      results,
      freshness: {
        indexedBlock: snapshot.indexedBlock,
        indexedBlockHash: snapshot.indexedBlockHash,
        observedAt: this.clock(),
      },
    };
  }
}
