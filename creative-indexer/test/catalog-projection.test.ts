import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogProjectionStore420 } from '../src/catalog-store.js';
import { CreativeIndexerStore } from '../src/store.js';
import type { CanonicalEvent } from '../src/types.js';

function event(
  n: number,
  eventType: string,
  payload: CanonicalEvent['payload'],
): CanonicalEvent {
  return {
    eventKey: `catalog:${n}`,
    blockNumber: 10_000 + n,
    blockHash: `0xblock${n}`,
    txHash: `0xtx${n}`,
    logIndex: 0,
    moduleKey: 'CATALOG',
    eventType,
    payload,
  };
}

test('HZ-2.3 catalog projection is replay-safe and serves canonical public pages', async () => {
  const base = new CreativeIndexerStore();
  const catalog = new CatalogProjectionStore420();
  try {
    await base.applySchema();
    await catalog.applySchema();
    await catalog.reset();
    await base.reset();

    await base.pool.query(
      `INSERT INTO creator_profiles(creator_id,account,label) VALUES
        (77,'0xcreator','Backstage Infamy')`,
    );
    await base.pool.query(`INSERT INTO works(work_id,rights_version) VALUES(901,1)`);
    await base.pool.query(
      `INSERT INTO recordings(recording_id,work_id,recording_class,parent_recording_id,rights_version) VALUES
        (501,901,'ORIGINAL',NULL,1),
        (502,901,'ORIGINAL',NULL,1),
        (503,901,'ORIGINAL',NULL,1)`,
    );

    const events: CanonicalEvent[] = [
      event(1, 'RELEASE_CREATED', {
        releaseId: 1,
        creatorId: 77,
        releaseType: 'ALBUM',
        metadataHash: '0xmeta1',
        artworkHash: '0xart1',
        createdAt: 1_800_000_000,
      }),
      event(2, 'RELEASE_METADATA_UPDATED', {
        releaseId: 1,
        metadataHash: '0xmeta2',
        artworkHash: '0xart2',
      }),
      event(3, 'RELEASE_TRACK_ADDED', { releaseId: 1, recordingId: 501, position: 0 }),
      event(4, 'RELEASE_TRACK_ADDED', { releaseId: 1, recordingId: 502, position: 1 }),
      event(5, 'RELEASE_TRACK_REMOVED', { releaseId: 1, recordingId: 501 }),
      event(6, 'RELEASE_TRACK_ADDED', { releaseId: 1, recordingId: 503, position: 1 }),
      event(7, 'CREATOR_PRESENTATION_UPDATED', {
        creatorId: 77,
        revision: 2,
        profileManifestHash: '0xprofile2',
        socialLinksHash: '0xsocial2',
      }),
      event(8, 'CREATOR_PRESENTATION_UPDATED', {
        creatorId: 77,
        revision: 1,
        profileManifestHash: '0xprofile1',
        socialLinksHash: '0xsocial1',
      }),
      event(9, 'RELEASE_PRESENTATION_UPDATED', {
        releaseId: 1,
        creatorId: 77,
        revision: 2,
        presentationHash: '0xrelease2',
        discoverabilityHash: '0xdiscover2',
        externalIdsHash: '0xids2',
      }),
      event(10, 'RELEASE_PRESENTATION_UPDATED', {
        releaseId: 1,
        creatorId: 77,
        revision: 1,
        presentationHash: '0xrelease1',
        discoverabilityHash: '0xdiscover1',
        externalIdsHash: '0xids1',
      }),
      event(11, 'RELEASE_PUBLISHED', { releaseId: 1, publishedAt: 1_800_000_100 }),
    ];

    await catalog.ingest(events);
    await catalog.ingest(events);

    const journal = await base.pool.query(
      `SELECT count(*)::int AS count FROM event_journal WHERE module_key='CATALOG'`,
    );
    assert.equal(journal.rows[0].count, events.length, 'canonical event replay must be idempotent');

    const creatorHistory = await base.pool.query(
      `SELECT revision FROM creator_presentation_revisions WHERE creator_id=77 ORDER BY revision`,
    );
    assert.deepEqual(creatorHistory.rows.map((row) => Number(row.revision)), [1, 2]);

    const creatorHead = await base.pool.query(
      `SELECT revision,profile_manifest_hash FROM creator_presentations_current WHERE creator_id=77`,
    );
    assert.equal(Number(creatorHead.rows[0].revision), 2);
    assert.equal(creatorHead.rows[0].profile_manifest_hash, '0xprofile2');

    const releaseHead = await base.pool.query(
      `SELECT revision,presentation_hash FROM release_presentations_current WHERE release_id=1`,
    );
    assert.equal(Number(releaseHead.rows[0].revision), 2);
    assert.equal(releaseHead.rows[0].presentation_hash, '0xrelease2');

    const releasePage = await catalog.getReleasePublicPage(1);
    assert.ok(releasePage);
    assert.equal(releasePage.creatorId, '77');
    assert.equal(releasePage.creatorLabel, 'Backstage Infamy');
    assert.equal(releasePage.releaseType, 'ALBUM');
    assert.equal(releasePage.metadataHash, '0xmeta2');
    assert.equal(releasePage.artworkHash, '0xart2');
    assert.equal(releasePage.presentationRevision, '2');
    assert.equal(releasePage.discoverabilityHash, '0xdiscover2');
    assert.deepEqual(releasePage.tracks.map((track) => [track.recordingId, track.position]), [
      ['502', 0],
      ['503', 1],
    ]);
    assert.deepEqual(releasePage.tracks.map((track) => track.workId), ['901', '901']);

    const creatorPage = await catalog.getCreatorPublicPage(77);
    assert.ok(creatorPage);
    assert.equal(creatorPage.presentationRevision, '2');
    assert.equal(creatorPage.profileManifestHash, '0xprofile2');
    assert.deepEqual(creatorPage.releases.map((release) => release.releaseId), ['1']);

    await catalog.ingest([
      event(12, 'RELEASE_WITHDRAWN', { releaseId: 1 }),
    ]);
    assert.equal(await catalog.getReleasePublicPage(1), null, 'withdrawn releases are not public pages');
    assert.deepEqual(await catalog.listPublishedReleases(77), []);
  } finally {
    await catalog.close();
    await base.close();
  }
});

test('HZ-2.3 projection rejects lifecycle-invalid catalog logs', async () => {
  const base = new CreativeIndexerStore();
  const catalog = new CatalogProjectionStore420();
  try {
    await base.applySchema();
    await catalog.applySchema();
    await catalog.reset();
    await base.reset();

    await catalog.ingest([
      event(101, 'RELEASE_CREATED', {
        releaseId: 42,
        creatorId: 77,
        releaseType: 'SINGLE',
        metadataHash: '0xmeta',
        artworkHash: '0xart',
        createdAt: 1_800_000_000,
      }),
      event(102, 'RELEASE_TRACK_ADDED', { releaseId: 42, recordingId: 501, position: 0 }),
      event(103, 'RELEASE_PUBLISHED', { releaseId: 42, publishedAt: 1_800_000_010 }),
    ]);

    await assert.rejects(
      catalog.ingest([
        event(104, 'RELEASE_METADATA_UPDATED', {
          releaseId: 42,
          metadataHash: '0xlate',
          artworkHash: '0xlate-art',
        }),
      ]),
      /canonical catalog lifecycle/,
    );

    const rejected = await base.pool.query(`SELECT event_key FROM event_journal WHERE event_key='catalog:104'`);
    assert.equal(rejected.rowCount, 0, 'failed projection must roll back its journal entry');
  } finally {
    await catalog.close();
    await base.close();
  }
});
