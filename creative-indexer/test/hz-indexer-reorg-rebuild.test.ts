import test from 'node:test';
import assert from 'node:assert/strict';
import { HzIndexerIntegration420 } from '../src/hz-indexer-integration.js';
import type { CanonicalEvent } from '../src/types.js';

function event(
  eventKey: string,
  blockNumber: number,
  blockHash: string,
  transactionIndex: number,
  logIndex: number,
  eventType: string,
  payload: CanonicalEvent['payload'],
  finalized = false,
): CanonicalEvent {
  return {
    eventKey,
    blockNumber,
    blockHash,
    parentHash: `0xparent${blockNumber}`,
    transactionIndex,
    txHash: `0xtx-${eventKey}`,
    logIndex,
    finalized,
    moduleKey: eventType.startsWith('SETTLEMENT_') || eventType.startsWith('RECORDING_')
      ? '420HZ_STREAMING_SETTLEMENT'
      : eventType.startsWith('RELEASE_')
        ? 'CATALOG'
        : 'CREATIVE',
    eventType,
    payload,
  };
}

test('HZ-AUDIT-6 replaces a non-finalized canonical tail and rebuilds every HZ projection exactly', async () => {
  const integration = new HzIndexerIntegration420();
  try {
    await integration.applySchemas();
    await integration.resetAll();

    const original: CanonicalEvent[] = [
      event('base:100', 100, '0xblock100a', 0, 0, 'CREATOR_CREATED', {
        creatorId: 77,
        account: '0xcreator',
        label: 'Backstage Infamy',
      }),
      event('catalog:101', 101, '0xblock101a', 0, 0, 'RELEASE_CREATED', {
        releaseId: 1,
        creatorId: 77,
        releaseType: 'ALBUM',
        metadataHash: '0xold-meta',
        artworkHash: '0xart',
        createdAt: 1000,
      }),
      event('catalog:102-old', 102, '0xblock102a', 0, 0, 'RELEASE_PUBLISHED', {
        releaseId: 1,
        publishedAt: 1100,
      }),
      event('stream:103-old', 103, '0xblock103a', 0, 0, 'SETTLEMENT_EPOCH_COMMITTED', {
        settlementId: '0xorphaned-settlement',
        playbackEpoch: 1,
        playbackRoot: '0xplayback-old',
        revenueRoot: '0xrevenue-old',
        totalPlayCount: 1,
        totalQualifiedMs: 100,
        grossRevenue: 10,
      }),
    ];

    const first = await integration.ingestCanonical(original);
    assert.deepEqual(first, { reorg: false, forkBlock: null, retainedEvents: 0, replacementEvents: 4 });

    const before = await integration.catalog.getReleasePublicPage(1);
    assert.ok(before);
    assert.equal(before.metadataHash, '0xold-meta');
    assert.ok(await integration.streaming.getSettlementOverview('0xorphaned-settlement'));

    const replacement: CanonicalEvent[] = [
      event('catalog:102-new', 102, '0xblock102b', 0, 0, 'RELEASE_METADATA_UPDATED', {
        releaseId: 1,
        metadataHash: '0xnew-meta',
        artworkHash: '0xnew-art',
      }),
      event('catalog:103-new', 103, '0xblock103b', 0, 0, 'RELEASE_PUBLISHED', {
        releaseId: 1,
        publishedAt: 1200,
      }),
      event('stream:104-new', 104, '0xblock104b', 0, 0, 'SETTLEMENT_EPOCH_COMMITTED', {
        settlementId: '0xcanonical-settlement',
        playbackEpoch: 2,
        playbackRoot: '0xplayback-new',
        revenueRoot: '0xrevenue-new',
        totalPlayCount: 2,
        totalQualifiedMs: 200,
        grossRevenue: 20,
      }),
    ];

    const reorg = await integration.ingestCanonical(replacement);
    assert.deepEqual(reorg, { reorg: true, forkBlock: 102, retainedEvents: 2, replacementEvents: 3 });

    const after = await integration.catalog.getReleasePublicPage(1);
    assert.ok(after);
    assert.equal(after.metadataHash, '0xnew-meta');
    assert.equal(after.artworkHash, '0xnew-art');
    assert.equal(after.publishedAt, '1200');

    assert.equal(await integration.streaming.getSettlementOverview('0xorphaned-settlement'), null);
    const canonicalSettlement = await integration.streaming.getSettlementOverview('0xcanonical-settlement');
    assert.ok(canonicalSettlement);
    assert.equal(canonicalSettlement.playbackEpoch, '2');

    const journal = await integration.base.pool.query(
      `SELECT event_key,block_number,block_hash,tx_index,log_index
       FROM event_journal ORDER BY block_number,tx_index,log_index,event_key`,
    );
    assert.deepEqual(journal.rows.map((row) => row.event_key), [
      'base:100',
      'catalog:101',
      'catalog:102-new',
      'catalog:103-new',
      'stream:104-new',
    ]);

    const firstDigest = await integration.digest();
    const rebuiltDigest = await integration.rebuildFromJournal();
    assert.equal(rebuiltDigest, firstDigest, 'journal rebuild must reproduce the complete post-reorg HZ projection');

    const replay = await integration.ingestCanonical(replacement);
    assert.equal(replay.reorg, false);
    assert.equal(await integration.digest(), firstDigest, 'canonical replacement replay must remain idempotent');
  } finally {
    await integration.close();
  }
});

test('HZ-AUDIT-6 refuses reorgs across finalized indexed blocks', async () => {
  const integration = new HzIndexerIntegration420();
  try {
    await integration.applySchemas();
    await integration.resetAll();

    await integration.ingestCanonical([
      event('final:200', 200, '0xfinal-a', 0, 0, 'CREATOR_CREATED', {
        creatorId: 88,
        account: '0xfinal',
        label: 'Final Artist',
      }, true),
    ]);

    await assert.rejects(
      integration.ingestCanonical([
        event('final:200-replacement', 200, '0xfinal-b', 0, 0, 'CREATOR_CREATED', {
          creatorId: 99,
          account: '0xreplacement',
          label: 'Replacement Artist',
        }),
      ]),
      /refusing reorg across finalized block 200/,
    );

    const creators = await integration.base.pool.query(`SELECT creator_id FROM creator_profiles ORDER BY creator_id`);
    assert.deepEqual(creators.rows.map((row) => Number(row.creator_id)), [88]);
  } finally {
    await integration.close();
  }
});

test('HZ-AUDIT-6 rejects non-canonical block transaction log ordering before mutation', async () => {
  const integration = new HzIndexerIntegration420();
  try {
    await integration.applySchemas();
    await integration.resetAll();

    await assert.rejects(
      integration.ingestCanonical([
        event('order:1', 300, '0xorder', 1, 0, 'CREATOR_CREATED', {
          creatorId: 1,
          account: '0x1',
          label: 'One',
        }),
        event('order:2', 300, '0xorder', 0, 1, 'CREATOR_CREATED', {
          creatorId: 2,
          account: '0x2',
          label: 'Two',
        }),
      ]),
      /not ordered by block\/transaction\/log position/,
    );

    const journal = await integration.base.pool.query(`SELECT count(*)::int AS count FROM event_journal`);
    assert.equal(journal.rows[0].count, 0);
  } finally {
    await integration.close();
  }
});
