import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureEvents } from '../src/fixture-events.js';
import { loadDecision10Fixture } from '../src/fixture.js';
import { CreativeIndexerStore } from '../src/store.js';

const fixturePath = process.env.CREATIVE_FIXTURE_PATH ?? '../artifacts/contracts/creative-kernel-v1.fixture.json';

test('Decision #10 projection is idempotent and exactly rebuildable', async () => {
  const fixture = await loadDecision10Fixture(fixturePath);
  const events = fixtureEvents(fixture);
  const store = new CreativeIndexerStore();
  try {
    await store.applySchema();
    await store.reset();

    await store.ingest(events);
    const firstDigest = await store.digest();

    await store.ingest(events);
    const idempotentDigest = await store.digest();
    assert.equal(idempotentDigest, firstDigest, 'replaying identical canonical logs must be idempotent');

    const work = await store.pool.query(`SELECT rights_version FROM works WHERE work_id=$1`, [fixture.workId]);
    assert.equal(work.rows[0].rights_version, fixture.workRightsVersion);

    const original = await store.pool.query(`SELECT rights_version FROM recordings WHERE recording_id=$1`, [fixture.originalRecordingId]);
    assert.equal(original.rows[0].rights_version, fixture.originalRightsVersion);

    const remix = await store.pool.query(`SELECT rights_version,parent_recording_id FROM recordings WHERE recording_id=$1`, [fixture.remixRecordingId]);
    assert.equal(remix.rows[0].rights_version, fixture.remixRightsVersion);
    assert.equal(Number(remix.rows[0].parent_recording_id), fixture.originalRecordingId);

    const currentOriginalShares = await store.pool.query(
      `SELECT creator_id,bps FROM rights_shares WHERE asset_type='RECORDING' AND asset_id=$1 AND rights_version=$2 ORDER BY creator_id`,
      [fixture.originalRecordingId, fixture.originalRightsVersion],
    );
    assert.deepEqual(
      currentOriginalShares.rows.map((r) => [Number(r.creator_id), r.bps]),
      [[fixture.aliceCreatorId, 6000], [fixture.carolCreatorId, 1000], [fixture.producerCreatorId, 3000]].sort((a,b) => a[0]-b[0]),
    );

    const pools = await store.pool.query(`SELECT asset_type,asset_id,total_received_wei::text AS amount FROM royalty_pools ORDER BY asset_type,asset_id`);
    const poolMap = new Map(pools.rows.map((r) => [`${r.asset_type}:${r.asset_id}`, r.amount]));
    assert.equal(poolMap.get(`WORK:${fixture.workId}`), fixture.expectedWorkPoolWei);
    assert.equal(poolMap.get(`RECORDING:${fixture.originalRecordingId}`), fixture.expectedOriginalPoolWei);
    assert.equal(poolMap.get(`RECORDING:${fixture.remixRecordingId}`), fixture.expectedRemixPoolWei);

    const meta = await store.pool.query(`SELECT key,value FROM projection_meta`);
    const metaMap = new Map(meta.rows.map((r) => [r.key, r.value]));
    const conserved = BigInt(fixture.expectedWorkPoolWei)
      + BigInt(fixture.expectedOriginalPoolWei)
      + BigInt(fixture.expectedRemixPoolWei)
      + BigInt(fixture.expectedTreasuryWei);
    assert.equal(conserved.toString(), fixture.expectedVaultBalanceWei);
    assert.equal(metaMap.get('treasuryWei'), fixture.expectedTreasuryWei);
    assert.equal(metaMap.get('vaultBalanceWei'), fixture.expectedVaultBalanceWei);

    const journalCount = await store.pool.query(`SELECT count(*)::int AS count FROM event_journal`);
    assert.equal(journalCount.rows[0].count, events.length);

    await store.reset();
    await store.ingest(events);
    const rebuiltDigest = await store.digest();
    assert.equal(rebuiltDigest, firstDigest, 'clean database rebuild must produce identical canonical projection digest');
  } finally {
    await store.close();
  }
});
