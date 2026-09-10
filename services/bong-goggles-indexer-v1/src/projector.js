import { createHash } from 'node:crypto';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

export function digest(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function eventKey(event) {
  return `${event.chainId}:${event.blockNumber}:${event.transactionIndex}:${event.logIndex}`;
}

function comparePosition(a, b) {
  return a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex;
}

function validateEvent(event) {
  for (const field of ['chainId', 'blockNumber', 'transactionIndex', 'logIndex']) {
    if (!Number.isSafeInteger(event[field]) || event[field] < 0) throw new Error(`invalid ${field}`);
  }
  for (const field of ['blockHash', 'transactionHash', 'eventName']) {
    if (typeof event[field] !== 'string' || event[field].length === 0) throw new Error(`invalid ${field}`);
  }
  if (!Array.isArray(event.mutations)) throw new Error('invalid mutations');
  for (const mutation of event.mutations) {
    if (typeof mutation.entityType !== 'string' || !mutation.entityType) throw new Error('invalid entityType');
    if (typeof mutation.entityId !== 'string' || !mutation.entityId) throw new Error('invalid entityId');
    if (!['UPSERT', 'DELETE'].includes(mutation.operation)) throw new Error('invalid operation');
    if (mutation.operation === 'UPSERT' && mutation.value === undefined) throw new Error('missing value');
  }
}

export class BongGogglesProjector {
  constructor({ schemaHash, chainId }) {
    if (typeof schemaHash !== 'string' || !schemaHash) throw new Error('schemaHash required');
    if (!Number.isSafeInteger(chainId) || chainId < 0) throw new Error('chainId required');
    this.schemaHash = schemaHash;
    this.chainId = chainId;
    this.events = [];
    this.eventDigests = new Map();
    this.blockHashes = new Map();
    this.entities = new Map();
  }

  applyBatch(events) {
    if (!Array.isArray(events)) throw new Error('events must be an array');
    const ordered = [...events].sort(comparePosition);

    for (const event of ordered) {
      validateEvent(event);
      if (event.chainId !== this.chainId) throw new Error('wrong chain');
      const knownBlockHash = this.blockHashes.get(event.blockNumber);
      if (knownBlockHash && knownBlockHash !== event.blockHash) throw new Error('reorg detected');

      const key = eventKey(event);
      const eventDigest = digest(event);
      const knownDigest = this.eventDigests.get(key);
      if (knownDigest) {
        if (knownDigest !== eventDigest) throw new Error('conflicting event identity');
        continue;
      }

      const last = this.events.at(-1);
      if (last && comparePosition(last, event) >= 0) throw new Error('non-monotonic event position');

      this.blockHashes.set(event.blockNumber, event.blockHash);
      this.eventDigests.set(key, eventDigest);
      this.events.push(structuredClone(event));
      this.#applyMutations(event);
    }

    return this.snapshot();
  }

  #applyMutations(event) {
    for (const mutation of event.mutations) {
      const key = `${mutation.entityType}:${mutation.entityId}`;
      if (mutation.operation === 'DELETE') {
        this.entities.delete(key);
      } else {
        this.entities.set(key, {
          entityType: mutation.entityType,
          entityId: mutation.entityId,
          value: structuredClone(mutation.value),
          source: {
            blockNumber: event.blockNumber,
            blockHash: event.blockHash,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex,
          },
        });
      }
    }
  }

  rollbackTo({ blockNumber, blockHash }) {
    if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) throw new Error('invalid rollback block');
    const knownHash = this.blockHashes.get(blockNumber);
    if (knownHash && knownHash !== blockHash) throw new Error('rollback hash mismatch');

    const retained = this.events.filter((event) => event.blockNumber <= blockNumber);
    this.events = [];
    this.eventDigests.clear();
    this.blockHashes.clear();
    this.entities.clear();
    this.applyBatch(retained);
    return this.snapshot();
  }

  snapshot() {
    const latest = this.events.at(-1) ?? null;
    const state = [...this.entities.values()].sort((a, b) => {
      const ak = `${a.entityType}:${a.entityId}`;
      const bk = `${b.entityType}:${b.entityId}`;
      return ak.localeCompare(bk);
    });
    return {
      schemaHash: this.schemaHash,
      chainId: this.chainId,
      indexedBlock: latest?.blockNumber ?? 0,
      indexedBlockHash: latest?.blockHash ?? null,
      eventCount: this.events.length,
      entityCount: state.length,
      stateRoot: digest({ schemaHash: this.schemaHash, chainId: this.chainId, state }),
    };
  }

  exportState() {
    return [...this.entities.values()].sort((a, b) => `${a.entityType}:${a.entityId}`.localeCompare(`${b.entityType}:${b.entityId}`));
  }

  cursorEnvelope(context) {
    for (const field of ['queryHash', 'rankerId']) {
      if (typeof context[field] !== 'string' || !context[field]) throw new Error(`missing ${field}`);
    }
    if (!Number.isSafeInteger(context.snapshotBlock) || context.snapshotBlock < 0) throw new Error('invalid snapshotBlock');
    if (!Number.isSafeInteger(context.position) || context.position < 0) throw new Error('invalid position');
    if (context.snapshotBlock > this.snapshot().indexedBlock) throw new Error('cursor ahead of index');

    const envelope = {
      schemaHash: this.schemaHash,
      chainId: this.chainId,
      viewer: context.viewer ?? null,
      searchClass: context.searchClass,
      queryHash: context.queryHash,
      filtersHash: context.filtersHash ?? null,
      snapshotBlock: context.snapshotBlock,
      position: context.position,
      rankerId: context.rankerId,
      canonicalCursorDigest: context.canonicalCursorDigest ?? null,
    };
    return { ...envelope, backendDigest: digest(envelope) };
  }

  static rebuild({ schemaHash, chainId, events }) {
    const projector = new BongGogglesProjector({ schemaHash, chainId });
    projector.applyBatch(events);
    return projector;
  }
}
