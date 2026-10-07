import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { CreativeIndexerStore } from './store.js';
import { CatalogProjectionStore420 } from './catalog-store.js';
import { StreamingSettlementProjectionStore420 } from './streaming-settlement-store.js';
import type { CanonicalEvent } from './types.js';

const BASE_EVENTS = new Set([
  'MODULE_REGISTERED', 'CREATOR_CREATED', 'WORK_REGISTERED', 'RECORDING_REGISTERED',
  'RIGHTS_VERSION_SET', 'CREDIT_ACCEPTED', 'LICENSE_ISSUED', 'RIGHTS_TRANSFER_ACCEPTED',
  'ROYALTY_SETTLED', 'FIXTURE_ECONOMICS_FINALIZED',
]);

const CATALOG_EVENTS = new Set([
  'RELEASE_CREATED', 'RELEASE_METADATA_UPDATED', 'RELEASE_TRACK_ADDED', 'RELEASE_TRACK_REMOVED',
  'RELEASE_PUBLISHED', 'RELEASE_WITHDRAWN', 'CREATOR_PRESENTATION_UPDATED', 'RELEASE_PRESENTATION_UPDATED',
]);

const STREAMING_EVENTS = new Set([
  'SETTLEMENT_EPOCH_COMMITTED', 'SETTLEMENT_EPOCH_FINALIZED',
  'RECORDING_REVENUE_ALLOCATED', 'SETTLEMENT_ALLOCATED', 'STREAMING_ROYALTY_ROUTED',
]);

export interface ReorgResult420 {
  reorg: boolean;
  forkBlock: number | null;
  retainedEvents: number;
  replacementEvents: number;
}

export class HzIndexerIntegration420 {
  readonly base: CreativeIndexerStore;
  readonly catalog: CatalogProjectionStore420;
  readonly streaming: StreamingSettlementProjectionStore420;

  constructor(connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/creative_indexer') {
    this.base = new CreativeIndexerStore(connectionString);
    this.catalog = new CatalogProjectionStore420(connectionString);
    this.streaming = new StreamingSettlementProjectionStore420(connectionString);
  }

  async close(): Promise<void> {
    await Promise.all([this.streaming.close(), this.catalog.close(), this.base.close()]);
  }

  async applySchemas(): Promise<void> {
    await this.base.applySchema();
    await this.catalog.applySchema();
    await this.streaming.applySchema();
  }

  async resetAll(): Promise<void> {
    const client = await this.base.pool.connect();
    try {
      await client.query('BEGIN');
      await this.truncateAll(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ingestCanonical(events: CanonicalEvent[]): Promise<ReorgResult420> {
    this.validateOrderedBatch(events);
    if (events.length === 0) {
      return { reorg: false, forkBlock: null, retainedEvents: 0, replacementEvents: 0 };
    }

    const forkBlock = await this.findForkBlock(events);
    if (forkBlock == null) {
      await this.applyBatchAtomically(events, false);
      return { reorg: false, forkBlock: null, retainedEvents: 0, replacementEvents: events.length };
    }

    const conflicting = await this.base.pool.query(
      `SELECT finalized FROM indexed_blocks WHERE block_number=$1`,
      [forkBlock],
    );
    if (conflicting.rowCount === 1 && conflicting.rows[0].finalized) {
      throw new Error(`refusing reorg across finalized block ${forkBlock}`);
    }

    const retained = await this.loadCanonicalEvents(forkBlock);
    const replacement = events.filter((event) => event.blockNumber >= forkBlock);
    if (replacement.length === 0 || replacement[0].blockNumber !== forkBlock) {
      throw new Error('replacement tail must begin at the first conflicting block');
    }

    await this.replaceAllAtomically([...retained, ...replacement]);

    return { reorg: true, forkBlock, retainedEvents: retained.length, replacementEvents: replacement.length };
  }

  async rebuildFromJournal(): Promise<string> {
    const canonical = await this.loadCanonicalEvents();
    await this.replaceAllAtomically(canonical);
    return this.digest();
  }

  async digest(): Promise<string> {
    const tables: Array<[string, string]> = [
      ['protocol_modules', 'module_key'],
      ['creator_profiles', 'creator_id'],
      ['works', 'work_id'],
      ['recordings', 'recording_id'],
      ['rights_versions', 'asset_type,asset_id,rights_version'],
      ['rights_shares', 'asset_type,asset_id,rights_version,creator_id'],
      ['contributor_credits', 'credit_id'],
      ['licenses', 'license_id'],
      ['rights_transfers', 'transfer_id'],
      ['royalty_pools', 'asset_type,asset_id'],
      ['royalty_balances', 'asset_type,asset_id,creator_id'],
      ['settlements', 'settlement_id'],
      ['projection_meta', 'key'],
      ['catalog_releases', 'release_id'],
      ['catalog_release_tracks', 'release_id,position,recording_id'],
      ['creator_presentation_revisions', 'creator_id,revision'],
      ['creator_presentations_current', 'creator_id'],
      ['release_presentation_revisions', 'release_id,revision'],
      ['release_presentations_current', 'release_id'],
      ['streaming_settlements', 'settlement_id'],
      ['streaming_recording_allocations', 'settlement_id,recording_id'],
    ];

    const canonical: Record<string, unknown[]> = {};
    for (const [table, orderBy] of tables) {
      const result = await this.base.pool.query(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
      canonical[table] = result.rows;
    }
    const json = JSON.stringify(canonical, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
    return createHash('sha256').update(json).digest('hex');
  }

  private async findForkBlock(events: CanonicalEvent[]): Promise<number | null> {
    let fork: number | null = null;
    for (const event of events) {
      const existing = await this.base.pool.query(
        `SELECT block_hash FROM indexed_blocks WHERE block_number=$1`,
        [event.blockNumber],
      );
      if (existing.rowCount === 1 && existing.rows[0].block_hash !== event.blockHash) {
        fork = fork == null ? event.blockNumber : Math.min(fork, event.blockNumber);
      }
    }
    return fork;
  }

  private async loadCanonicalEvents(beforeBlock?: number): Promise<CanonicalEvent[]> {
    const result = await this.base.pool.query(
      `SELECT j.event_key,j.block_number,j.block_hash,j.tx_index,j.tx_hash,j.log_index,
              j.module_key,j.event_type,j.payload,b.parent_hash,b.finalized
       FROM event_journal j
       JOIN indexed_blocks b ON b.block_number=j.block_number AND b.block_hash=j.block_hash
       WHERE b.canonical=true
         AND ($1::bigint IS NULL OR j.block_number < $1)
       ORDER BY j.block_number,j.tx_index,j.log_index,j.event_key`,
      [beforeBlock ?? null],
    );
    return result.rows.map((row) => ({
      eventKey: row.event_key,
      blockNumber: Number(row.block_number),
      blockHash: row.block_hash,
      parentHash: row.parent_hash ?? undefined,
      transactionIndex: Number(row.tx_index),
      txHash: row.tx_hash,
      logIndex: Number(row.log_index),
      finalized: Boolean(row.finalized),
      moduleKey: row.module_key,
      eventType: row.event_type,
      payload: row.payload,
    }));
  }

  private validateOrderedBatch(events: CanonicalEvent[]): void {
    const keys = new Set<string>();
    const blockMetadata = new Map<number, { hash: string; parentHash?: string }>();
    let previous: CanonicalEvent | null = null;

    for (const event of events) {
      if (keys.has(event.eventKey)) throw new Error(`duplicate event key in batch: ${event.eventKey}`);
      keys.add(event.eventKey);

      const known = blockMetadata.get(event.blockNumber);
      if (known != null) {
        if (known.hash !== event.blockHash) {
          throw new Error(`multiple block hashes supplied for block ${event.blockNumber}`);
        }
        if (known.parentHash != null && event.parentHash != null && known.parentHash !== event.parentHash) {
          throw new Error(`multiple parent hashes supplied for block ${event.blockNumber}`);
        }
      } else {
        blockMetadata.set(event.blockNumber, { hash: event.blockHash, parentHash: event.parentHash });
      }

      if (previous != null) {
        const previousTx = previous.transactionIndex ?? 0;
        const currentTx = event.transactionIndex ?? 0;
        const outOfOrder =
          event.blockNumber < previous.blockNumber ||
          (event.blockNumber === previous.blockNumber && currentTx < previousTx) ||
          (event.blockNumber === previous.blockNumber && currentTx === previousTx && event.logIndex < previous.logIndex);
        if (outOfOrder) throw new Error('canonical event batch is not ordered by block/transaction/log position');
      }
      previous = event;
    }
  }

  private async applyBatchAtomically(events: CanonicalEvent[], truncate: boolean): Promise<void> {
    const client = await this.base.pool.connect();
    try {
      await client.query('BEGIN');
      if (truncate) await this.truncateAll(client);
      for (const event of events) {
        await this.applyEvent(client, event);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async replaceAllAtomically(events: CanonicalEvent[]): Promise<void> {
    this.validateOrderedBatch(events);
    await this.applyBatchAtomically(events, true);
  }

  private async applyEvent(client: PoolClient, event: CanonicalEvent): Promise<void> {
    const prior = await client.query(
      `SELECT block_number,block_hash,tx_index,tx_hash,log_index FROM event_journal WHERE event_key=$1`,
      [event.eventKey],
    );

    if (prior.rowCount === 1) {
      const row = prior.rows[0];
      const sameProvenance =
        Number(row.block_number) === event.blockNumber
        && row.block_hash === event.blockHash
        && Number(row.tx_index) === (event.transactionIndex ?? 0)
        && row.tx_hash === event.txHash
        && Number(row.log_index) === event.logIndex;
      if (!sameProvenance) throw new Error(`event replay provenance mismatch: ${event.eventKey}`);
    }

    const block = await client.query(
      `INSERT INTO indexed_blocks(block_number,block_hash,parent_hash,canonical,finalized)
       VALUES($1,$2,$3,true,$4)
       ON CONFLICT(block_number) DO UPDATE SET
         parent_hash=COALESCE(indexed_blocks.parent_hash, EXCLUDED.parent_hash),
         canonical=true,
         finalized=indexed_blocks.finalized OR EXCLUDED.finalized
       WHERE indexed_blocks.block_hash=EXCLUDED.block_hash
         AND (
           indexed_blocks.parent_hash IS NULL
           OR EXCLUDED.parent_hash IS NULL
           OR indexed_blocks.parent_hash=EXCLUDED.parent_hash
         )
       RETURNING block_number`,
      [event.blockNumber, event.blockHash, event.parentHash ?? null, event.finalized ?? false],
    );
    if (block.rowCount !== 1) {
      throw new Error(`indexed block provenance conflict at block ${event.blockNumber}`);
    }

    if (prior.rowCount === 1) return;

    await client.query(
      `INSERT INTO event_journal
        (event_key,block_number,block_hash,tx_index,tx_hash,log_index,module_key,event_type,payload)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [
        event.eventKey,
        event.blockNumber,
        event.blockHash,
        event.transactionIndex ?? 0,
        event.txHash,
        event.logIndex,
        event.moduleKey,
        event.eventType,
        JSON.stringify(event.payload),
      ],
    );

    if (BASE_EVENTS.has(event.eventType)) {
      await this.base.projectCanonicalEvent(client, event);
    } else if (CATALOG_EVENTS.has(event.eventType)) {
      await this.catalog.projectCanonicalEvent(client, event);
    } else if (STREAMING_EVENTS.has(event.eventType)) {
      await this.streaming.projectCanonicalEvent(client, event);
    } else {
      throw new Error(`unsupported HZ canonical event ${event.eventType}`);
    }
  }

  private async truncateAll(client: PoolClient): Promise<void> {
    await client.query(`
      TRUNCATE TABLE
        streaming_recording_allocations, streaming_settlements,
        release_presentations_current, release_presentation_revisions,
        creator_presentations_current, creator_presentation_revisions,
        catalog_release_tracks, catalog_releases,
        projection_meta, settlements, royalty_balances, royalty_pools,
        rights_transfers, licenses, contributor_credits, rights_shares,
        rights_versions, recordings, works, creator_profiles,
        protocol_modules, event_journal, indexed_blocks
      RESTART IDENTITY CASCADE
    `);
  }
}
