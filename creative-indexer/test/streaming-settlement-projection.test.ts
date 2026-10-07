import test from 'node:test';
import assert from 'node:assert/strict';
import { CreativeIndexerStore } from '../src/store.js';
import { StreamingSettlementProjectionStore420 } from '../src/streaming-settlement-store.js';
import type { CanonicalEvent } from '../src/types.js';

function event(n: number, eventType: string, payload: CanonicalEvent['payload']): CanonicalEvent {
  return {
    eventKey: `hz4:${n}`,
    blockNumber: 20_000 + n,
    blockHash: `0xblock${n}`,
    txHash: `0xtx${n}`,
    logIndex: 0,
    moduleKey: '420HZ_STREAMING_SETTLEMENT',
    eventType,
    payload,
  };
}

test('HZ-4.4 projects settlement lifecycle, allocations and royalty routing replay-safely', async () => {
  const base = new CreativeIndexerStore();
  const store = new StreamingSettlementProjectionStore420();
  try {
    await base.applySchema();
    await store.applySchema();
    await store.reset();
    await base.reset();

    const settlementId = '0xsettlement1';
    const events: CanonicalEvent[] = [
      event(1, 'SETTLEMENT_EPOCH_COMMITTED', {
        settlementId,
        playbackEpoch: 42,
        playbackRoot: '0xplayback',
        revenueRoot: '0xrevenue',
        totalPlayCount: 30,
        totalQualifiedMs: 3000,
        grossRevenue: 1000,
      }),
      event(2, 'SETTLEMENT_EPOCH_FINALIZED', { settlementId, playbackEpoch: 42 }),
      event(3, 'RECORDING_REVENUE_ALLOCATED', {
        settlementId,
        recordingId: 501,
        playCount: 10,
        qualifiedMs: 1000,
        revenue: 333,
      }),
      event(4, 'RECORDING_REVENUE_ALLOCATED', {
        settlementId,
        recordingId: 502,
        playCount: 20,
        qualifiedMs: 2000,
        revenue: 667,
      }),
      event(5, 'SETTLEMENT_ALLOCATED', {
        settlementId,
        playbackEpoch: 42,
        allocationRoot: '0xallocation',
        recordingCount: 2,
        allocatedRevenue: 1000,
      }),
      event(6, 'STREAMING_ROYALTY_ROUTED', {
        settlementId,
        recordingId: 501,
        routeSettlementId: '0xroute501',
        revenue: 333,
      }),
    ];

    await store.ingest(events);
    await store.ingest(events);

    const overview = await store.getSettlementOverview(settlementId);
    assert.ok(overview);
    assert.equal(overview.state, 'FINALIZED');
    assert.equal(overview.playbackEpoch, '42');
    assert.equal(overview.grossRevenue, '1000');
    assert.equal(overview.allocatedRevenue, '1000');
    assert.equal(overview.recordingCount, 2);
    assert.equal(overview.routedRevenue, '333');
    assert.equal(overview.remainingRevenue, '667');

    const allocations = await store.listRecordingAllocations(settlementId);
    assert.deepEqual(allocations, [
      {
        recordingId: '501', playCount: '10', qualifiedMs: '1000', revenue: '333',
        routed: true, routeSettlementId: '0xroute501',
      },
      {
        recordingId: '502', playCount: '20', qualifiedMs: '2000', revenue: '667',
        routed: false, routeSettlementId: null,
      },
    ]);

    const journal = await base.pool.query(
      `SELECT count(*)::int AS count FROM event_journal WHERE module_key='420HZ_STREAMING_SETTLEMENT'`,
    );
    assert.equal(journal.rows[0].count, events.length);
  } finally {
    await store.close();
    await base.close();
  }
});

test('HZ-4.4 fails closed when allocation projections do not conserve settlement totals', async () => {
  const base = new CreativeIndexerStore();
  const store = new StreamingSettlementProjectionStore420();
  try {
    await base.applySchema();
    await store.applySchema();
    await store.reset();
    await base.reset();

    const settlementId = '0xbadsettlement';
    await store.ingest([
      event(101, 'SETTLEMENT_EPOCH_COMMITTED', {
        settlementId,
        playbackEpoch: 99,
        playbackRoot: '0xplayback99',
        revenueRoot: '0xrevenue99',
        totalPlayCount: 20,
        totalQualifiedMs: 2000,
        grossRevenue: 1000,
      }),
      event(102, 'SETTLEMENT_EPOCH_FINALIZED', { settlementId, playbackEpoch: 99 }),
      event(103, 'RECORDING_REVENUE_ALLOCATED', {
        settlementId,
        recordingId: 700,
        playCount: 20,
        qualifiedMs: 2000,
        revenue: 999,
      }),
    ]);

    await assert.rejects(
      store.ingest([
        event(104, 'SETTLEMENT_ALLOCATED', {
          settlementId,
          playbackEpoch: 99,
          allocationRoot: '0xbadroot',
          recordingCount: 1,
          allocatedRevenue: 1000,
        }),
      ]),
      /conservation/,
    );

    const rejected = await base.pool.query(`SELECT event_key FROM event_journal WHERE event_key='hz4:104'`);
    assert.equal(rejected.rowCount, 0, 'invalid projection must roll back its event-journal entry');
  } finally {
    await store.close();
    await base.close();
  }
});
