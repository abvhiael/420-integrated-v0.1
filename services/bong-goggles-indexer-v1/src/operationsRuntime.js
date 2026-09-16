import { BongGogglesProjector } from './projector.js';
import { toProjectorEvent } from './contractEventAdapters.js';

const REQUIRED_CONTRACTS = [
  'profileRegistry',
  'relationshipGraph',
  'socialObjectRegistry',
  'communityRegistry',
  'discoveryRegistry',
  'searchIndexSurface',
];

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function integer(value, field, min = 0) {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`invalid ${field}`);
  return value;
}

function normalizeAddress(address, field) {
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address)) {
    throw new Error(`invalid ${field}`);
  }
  return address.toLowerCase();
}

export function validateIndexerDeploymentConfig(config) {
  const c = required(config, 'deployment config');
  const contracts = required(c.contracts, 'contracts');
  const normalized = {};
  for (const key of REQUIRED_CONTRACTS) normalized[key] = normalizeAddress(contracts[key], `contracts.${key}`);
  return {
    chainId: integer(c.chainId, 'chainId', 1),
    schemaHash: required(c.schemaHash, 'schemaHash'),
    startBlock: integer(c.startBlock ?? 0, 'startBlock'),
    confirmations: integer(c.confirmations ?? 2, 'confirmations'),
    reorgWindow: integer(c.reorgWindow ?? 64, 'reorgWindow', 1),
    maxBlockSpan: integer(c.maxBlockSpan ?? 500, 'maxBlockSpan', 1),
    staleAfterBlocks: integer(c.staleAfterBlocks ?? 12, 'staleAfterBlocks', 1),
    contracts: normalized,
  };
}

export function verifyDeterministicRebuild(projector) {
  const rebuilt = BongGogglesProjector.rebuild({
    schemaHash: projector.schemaHash,
    chainId: projector.chainId,
    events: structuredClone(projector.events),
  });
  const before = projector.snapshot();
  const after = rebuilt.snapshot();
  if (before.stateRoot !== after.stateRoot || before.eventCount !== after.eventCount || before.indexedBlockHash !== after.indexedBlockHash) {
    throw new Error('deterministic rebuild mismatch');
  }
  return { ok: true, snapshot: after };
}

export class MemoryProjectionStore {
  constructor() { this.events = null; }
  save(projector) { this.events = structuredClone(projector.events); return projector.snapshot(); }
  load({ schemaHash, chainId }) {
    if (!this.events) return null;
    return BongGogglesProjector.rebuild({ schemaHash, chainId, events: structuredClone(this.events) });
  }
}

export class BongGogglesIndexerRuntime {
  constructor({ config, provider, decodeLog, hydrateState, store, logger = () => {}, now = () => Date.now() }) {
    this.config = validateIndexerDeploymentConfig(config);
    for (const [name, fn] of Object.entries({ decodeLog, hydrateState })) {
      if (typeof fn !== 'function') throw new Error(`${name} required`);
    }
    if (!provider || typeof provider.getBlockNumber !== 'function' || typeof provider.getBlock !== 'function' || typeof provider.getLogs !== 'function') {
      throw new Error('provider interface required');
    }
    if (!store || typeof store.save !== 'function' || typeof store.load !== 'function') throw new Error('projection store required');
    this.provider = provider;
    this.decodeLog = decodeLog;
    this.hydrateState = hydrateState;
    this.store = store;
    this.logger = logger;
    this.now = now;
    this.projector = store.load({ schemaHash: this.config.schemaHash, chainId: this.config.chainId })
      ?? new BongGogglesProjector({ schemaHash: this.config.schemaHash, chainId: this.config.chainId });
    this.lastObservedHead = 0;
    this.lastSyncAt = null;
    this.lastError = null;
    this.reorgCount = 0;
  }

  addresses() { return Object.values(this.config.contracts); }

  log(level, event, detail = {}) {
    this.logger({ level, event, chainId: this.config.chainId, at: this.now(), ...detail });
  }

  async canonicalHash(blockNumber) {
    const block = await this.provider.getBlock(blockNumber);
    return block?.hash ?? null;
  }

  async reconcileHead() {
    const snapshot = this.projector.snapshot();
    if (snapshot.indexedBlock === 0 || snapshot.indexedBlockHash === null) return { reorg: false };
    const current = await this.canonicalHash(snapshot.indexedBlock);
    if (current === snapshot.indexedBlockHash) return { reorg: false };

    const floor = Math.max(0, snapshot.indexedBlock - this.config.reorgWindow);
    let rollbackBlock = snapshot.indexedBlock - 1;
    while (rollbackBlock >= floor) {
      const persistedHash = this.projector.blockHashes.get(rollbackBlock);
      if (persistedHash && await this.canonicalHash(rollbackBlock) === persistedHash) break;
      rollbackBlock -= 1;
    }
    if (rollbackBlock < floor) throw new Error('reorg exceeds configured window');

    this.projector = BongGogglesProjector.rebuild({
      schemaHash: this.config.schemaHash,
      chainId: this.config.chainId,
      events: this.projector.events.filter((event) => event.blockNumber <= rollbackBlock),
    });
    this.store.save(this.projector);
    this.reorgCount += 1;
    this.log('warn', 'reorg_recovered', { rollbackBlock });
    return { reorg: true, rollbackBlock };
  }

  async syncOnce() {
    try {
      const head = integer(await this.provider.getBlockNumber(), 'provider head');
      this.lastObservedHead = head;
      await this.reconcileHead();
      const safeHead = Math.max(0, head - this.config.confirmations);
      let fromBlock = Math.max(this.config.startBlock, this.projector.snapshot().indexedBlock + 1);
      let applied = 0;

      while (fromBlock <= safeHead) {
        const toBlock = Math.min(safeHead, fromBlock + this.config.maxBlockSpan - 1);
        const logs = await this.provider.getLogs({ fromBlock, toBlock, address: this.addresses() });
        const ordered = [...logs].sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex);
        const events = [];
        for (const log of ordered) {
          const decoded = await this.decodeLog(log);
          if (!decoded) continue;
          const state = await this.hydrateState(decoded, log.blockNumber);
          events.push(toProjectorEvent({
            ...decoded,
            chainId: this.config.chainId,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            transactionIndex: log.transactionIndex,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
          }, state));
        }
        if (events.length > 0) {
          this.projector.applyBatch(events);
          applied += events.length;
        }
        this.store.save(this.projector);
        this.log('info', 'range_indexed', { fromBlock, toBlock, eventCount: events.length });
        fromBlock = toBlock + 1;
      }

      verifyDeterministicRebuild(this.projector);
      this.lastSyncAt = this.now();
      this.lastError = null;
      return { applied, ...this.health() };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'unknown error';
      this.log('error', 'sync_failed', { message: this.lastError });
      throw error;
    }
  }

  health() {
    const snapshot = this.projector.snapshot();
    const safeHead = Math.max(0, this.lastObservedHead - this.config.confirmations);
    const lagBlocks = Math.max(0, safeHead - snapshot.indexedBlock);
    const status = this.lastError ? 'degraded' : lagBlocks > this.config.staleAfterBlocks ? 'stale' : lagBlocks > 0 ? 'catching_up' : 'ready';
    return {
      status,
      authoritative: false,
      chainId: this.config.chainId,
      indexedBlock: snapshot.indexedBlock,
      indexedBlockHash: snapshot.indexedBlockHash,
      observedHead: this.lastObservedHead,
      safeHead,
      lagBlocks,
      eventCount: snapshot.eventCount,
      entityCount: snapshot.entityCount,
      stateRoot: snapshot.stateRoot,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      reorgCount: this.reorgCount,
    };
  }
}
