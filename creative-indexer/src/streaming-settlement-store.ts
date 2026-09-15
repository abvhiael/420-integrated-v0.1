import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import type { CanonicalEvent } from './types.js';

export interface StreamingSettlementOverview420 {
  settlementId: string;
  playbackEpoch: string;
  state: string;
  totalPlayCount: string;
  totalQualifiedMs: string;
  grossRevenue: string;
  allocationRoot: string | null;
  recordingCount: number | null;
  allocatedRevenue: string | null;
  routedRevenue: string;
  remainingRevenue: string;
}

export interface StreamingRecordingAllocation420 {
  recordingId: string;
  playCount: string;
  qualifiedMs: string;
  revenue: string;
  routed: boolean;
  routeSettlementId: string | null;
}

export class StreamingSettlementProjectionStore420 {
  readonly pool: Pool;

  constructor(connectionString = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/creative_indexer') {
    this.pool = new Pool({ connectionString });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async applySchema(schemaPath = new URL('../sql/003_streaming_settlement.sql', import.meta.url)): Promise<void> {
    const sql = await readFile(schemaPath, 'utf8');
    await this.pool.query(sql);
  }

  async reset(): Promise<void> {
    await this.pool.query(`TRUNCATE TABLE streaming_recording_allocations, streaming_settlements CASCADE`);
  }

  async ingest(events: CanonicalEvent[]): Promise<void> {
    for (const event of events) {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const inserted = await client.query(
          `INSERT INTO event_journal
            (event_key, block_number, block_hash, tx_hash, log_index, module_key, event_type, payload)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
           ON CONFLICT (event_key) DO NOTHING
           RETURNING event_key`,
          [event.eventKey, event.blockNumber, event.blockHash, event.txHash, event.logIndex, event.moduleKey, event.eventType, JSON.stringify(event.payload)],
        );
        if (inserted.rowCount === 1) {
          await client.query(
            `INSERT INTO indexed_blocks(block_number, block_hash, canonical, finalized)
             VALUES ($1,$2,true,true)
             ON CONFLICT (block_number) DO UPDATE SET block_hash=EXCLUDED.block_hash, canonical=true, finalized=true`,
            [event.blockNumber, event.blockHash],
          );
          await this.project(client, event);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }

  private async project(c: PoolClient, e: CanonicalEvent): Promise<void> {
    const p = e.payload;
    switch (e.eventType) {
      case 'SETTLEMENT_EPOCH_COMMITTED':
        await c.query(
          `INSERT INTO streaming_settlements
            (settlement_id,playback_epoch,playback_root,revenue_root,total_play_count,total_qualified_ms,gross_revenue,state,committed_block)
           VALUES($1,$2,$3,$4,$5,$6,$7,'COMMITTED',$8)
           ON CONFLICT(settlement_id) DO NOTHING`,
          [p.settlementId, p.playbackEpoch, p.playbackRoot, p.revenueRoot, p.totalPlayCount, p.totalQualifiedMs, p.grossRevenue, e.blockNumber],
        );
        break;
      case 'SETTLEMENT_EPOCH_FINALIZED':
        await this.requireUpdated(
          c,
          `UPDATE streaming_settlements SET state='FINALIZED', finalized_block=$2
           WHERE settlement_id=$1 AND state='COMMITTED'`,
          [p.settlementId, e.blockNumber],
          'settlement finalization',
        );
        break;
      case 'RECORDING_REVENUE_ALLOCATED':
        await this.requireSettlementState(c, String(p.settlementId), 'FINALIZED');
        await c.query(
          `INSERT INTO streaming_recording_allocations
            (settlement_id,recording_id,play_count,qualified_ms,revenue)
           VALUES($1,$2,$3,$4,$5)
           ON CONFLICT(settlement_id,recording_id) DO NOTHING`,
          [p.settlementId, p.recordingId, p.playCount, p.qualifiedMs, p.revenue],
        );
        break;
      case 'SETTLEMENT_ALLOCATED': {
        await this.requireSettlementState(c, String(p.settlementId), 'FINALIZED');
        const sums = await c.query(
          `SELECT count(*)::int AS recording_count,
                  COALESCE(sum(revenue),0)::text AS allocated_revenue,
                  COALESCE(sum(play_count),0)::text AS total_play_count,
                  COALESCE(sum(qualified_ms),0)::text AS total_qualified_ms
           FROM streaming_recording_allocations WHERE settlement_id=$1`,
          [p.settlementId],
        );
        const settlement = await c.query(
          `SELECT total_play_count::text,total_qualified_ms::text,gross_revenue::text
           FROM streaming_settlements WHERE settlement_id=$1`,
          [p.settlementId],
        );
        if (settlement.rowCount !== 1) throw new Error('allocation references unknown settlement');
        const projected = sums.rows[0];
        const canonical = settlement.rows[0];
        if (
          projected.recording_count !== Number(p.recordingCount) ||
          projected.allocated_revenue !== String(p.allocatedRevenue) ||
          projected.total_play_count !== canonical.total_play_count ||
          projected.total_qualified_ms !== canonical.total_qualified_ms ||
          projected.allocated_revenue !== canonical.gross_revenue
        ) {
          throw new Error('allocation projection violates settlement conservation');
        }
        await this.requireUpdated(
          c,
          `UPDATE streaming_settlements
           SET allocation_root=$2, recording_count=$3, allocated_revenue=$4
           WHERE settlement_id=$1 AND allocation_root IS NULL`,
          [p.settlementId, p.allocationRoot, p.recordingCount, p.allocatedRevenue],
          'settlement allocation',
        );
        break;
      }
      case 'STREAMING_ROYALTY_ROUTED': {
        const allocation = await c.query(
          `SELECT revenue::text,routed FROM streaming_recording_allocations
           WHERE settlement_id=$1 AND recording_id=$2`,
          [p.settlementId, p.recordingId],
        );
        if (allocation.rowCount !== 1) throw new Error('royalty route references unknown recording allocation');
        if (allocation.rows[0].routed) throw new Error('royalty route replay violates projection state');
        if (allocation.rows[0].revenue !== String(p.revenue)) throw new Error('royalty route revenue mismatches allocation');
        await c.query(
          `UPDATE streaming_recording_allocations
           SET routed=true,route_settlement_id=$3,routed_block=$4
           WHERE settlement_id=$1 AND recording_id=$2`,
          [p.settlementId, p.recordingId, p.routeSettlementId, e.blockNumber],
        );
        await c.query(
          `UPDATE streaming_settlements SET routed_revenue=routed_revenue+$2 WHERE settlement_id=$1`,
          [p.settlementId, p.revenue],
        );
        break;
      }
      default:
        throw new Error(`unsupported streaming settlement event ${e.eventType}`);
    }
  }

  private async requireSettlementState(c: PoolClient, settlementId: string, state: string): Promise<void> {
    const result = await c.query(`SELECT state FROM streaming_settlements WHERE settlement_id=$1`, [settlementId]);
    if (result.rowCount !== 1 || result.rows[0].state !== state) {
      throw new Error(`streaming settlement must be ${state}`);
    }
  }

  private async requireUpdated(c: PoolClient, sql: string, values: unknown[], operation: string): Promise<void> {
    const result = await c.query(sql, values);
    if (result.rowCount !== 1) throw new Error(`${operation} violates canonical streaming settlement lifecycle`);
  }

  async getSettlementOverview(settlementId: string): Promise<StreamingSettlementOverview420 | null> {
    const result = await this.pool.query(
      `SELECT settlement_id,playback_epoch,state,total_play_count::text,total_qualified_ms::text,
              gross_revenue::text,allocation_root,recording_count,allocated_revenue::text,routed_revenue::text,
              (gross_revenue-routed_revenue)::text AS remaining_revenue
       FROM streaming_settlements WHERE settlement_id=$1`,
      [settlementId],
    );
    if (result.rowCount !== 1) return null;
    const r = result.rows[0];
    return {
      settlementId: r.settlement_id,
      playbackEpoch: String(r.playback_epoch),
      state: r.state,
      totalPlayCount: r.total_play_count,
      totalQualifiedMs: r.total_qualified_ms,
      grossRevenue: r.gross_revenue,
      allocationRoot: r.allocation_root ?? null,
      recordingCount: r.recording_count == null ? null : Number(r.recording_count),
      allocatedRevenue: r.allocated_revenue ?? null,
      routedRevenue: r.routed_revenue,
      remainingRevenue: r.remaining_revenue,
    };
  }

  async listRecordingAllocations(settlementId: string): Promise<StreamingRecordingAllocation420[]> {
    const result = await this.pool.query(
      `SELECT recording_id::text,play_count::text,qualified_ms::text,revenue::text,routed,route_settlement_id
       FROM streaming_recording_allocations WHERE settlement_id=$1 ORDER BY recording_id`,
      [settlementId],
    );
    return result.rows.map((r) => ({
      recordingId: r.recording_id,
      playCount: r.play_count,
      qualifiedMs: r.qualified_ms,
      revenue: r.revenue,
      routed: Boolean(r.routed),
      routeSettlementId: r.route_settlement_id ?? null,
    }));
  }
}
