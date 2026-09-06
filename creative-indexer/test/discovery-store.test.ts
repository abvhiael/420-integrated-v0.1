import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogProjectionStore420 } from '../src/catalog-store.js';
import { CreativeIndexerStore } from '../src/store.js';
import { DiscoveryProjectionStore420 } from '../src/discovery-store.js';
import type { CanonicalEvent } from '../src/types.js';

function event(n: number, eventType: string, payload: CanonicalEvent['payload']): CanonicalEvent {
  return {
    eventKey: `discovery:${n}`,
    blockNumber: 20_000 + n,
    blockHash: `0xblock${n}`,
    txHash: `0xtx${n}`,
    logIndex: 0,
    moduleKey: 'CATALOG',
    eventType,
    payload,
  };
}

test('HZ-2.4 discovery is bounded, filterable, deterministic and excludes non-public releases', async () => {
  const base = new CreativeIndexerStore();
  const catalog = new CatalogProjectionStore420();
  const discovery = new DiscoveryProjectionStore420();
  try {
    await base.applySchema();
    await catalog.applySchema();
    await catalog.reset();
    await base.reset();

    await base.pool.query(
      `INSERT INTO creator_profiles(creator_id,account,label) VALUES
        (77,'0xbackstage','Backstage Infamy'),
        (88,'0xother','Other Artist')`,
    );
    await base.pool.query(`INSERT INTO works(work_id,rights_version) VALUES(901,1),(902,1)`);
    await base.pool.query(
      `INSERT INTO recordings(recording_id,work_id,recording_class,parent_recording_id,rights_version) VALUES
        (501,901,'ORIGINAL',NULL,1),
        (502,902,'ORIGINAL',NULL,1),
        (503,901,'ORIGINAL',NULL,1)`,
    );

    await catalog.ingest([
      event(1, 'RELEASE_CREATED', { releaseId: 1, creatorId: 77, releaseType: 'ALBUM', metadataHash: '0xm1', artworkHash: '0xa1', createdAt: 100 }),
      event(2, 'RELEASE_TRACK_ADDED', { releaseId: 1, recordingId: 501, position: 0 }),
      event(3, 'RELEASE_PUBLISHED', { releaseId: 1, publishedAt: 1000 }),
      event(4, 'RELEASE_CREATED', { releaseId: 2, creatorId: 77, releaseType: 'SINGLE', metadataHash: '0xm2', artworkHash: '0xa2', createdAt: 101 }),
      event(5, 'RELEASE_TRACK_ADDED', { releaseId: 2, recordingId: 502, position: 0 }),
      event(6, 'RELEASE_PUBLISHED', { releaseId: 2, publishedAt: 1000 }),
      event(7, 'RELEASE_CREATED', { releaseId: 3, creatorId: 88, releaseType: 'SINGLE', metadataHash: '0xm3', artworkHash: '0xa3', createdAt: 102 }),
      event(8, 'RELEASE_TRACK_ADDED', { releaseId: 3, recordingId: 503, position: 0 }),
      event(9, 'RELEASE_PUBLISHED', { releaseId: 3, publishedAt: 900 }),
      event(10, 'RELEASE_CREATED', { releaseId: 4, creatorId: 77, releaseType: 'EP', metadataHash: '0xm4', artworkHash: '0xa4', createdAt: 103 }),
      event(11, 'RELEASE_TRACK_ADDED', { releaseId: 4, recordingId: 501, position: 0 }),
      event(12, 'RELEASE_CREATED', { releaseId: 5, creatorId: 77, releaseType: 'LIVE', metadataHash: '0xm5', artworkHash: '0xa5', createdAt: 104 }),
      event(13, 'RELEASE_TRACK_ADDED', { releaseId: 5, recordingId: 501, position: 0 }),
      event(14, 'RELEASE_PUBLISHED', { releaseId: 5, publishedAt: 800 }),
      event(15, 'RELEASE_WITHDRAWN', { releaseId: 5 }),
      event(16, 'CREATOR_PRESENTATION_UPDATED', { creatorId: 77, revision: 1, profileManifestHash: '0xprofile', socialLinksHash: '0xsocial' }),
    ]);

    const first = await discovery.discoverPublishedReleases({ limit: 2 });
    assert.deepEqual(first.items.map((item) => item.releaseId), ['2', '1']);
    assert.deepEqual(first.nextCursor, { publishedAt: '1000', releaseId: '1' });

    const second = await discovery.discoverPublishedReleases({ limit: 2, cursor: first.nextCursor! });
    assert.deepEqual(second.items.map((item) => item.releaseId), ['3']);
    assert.equal(second.nextCursor, null);

    const creatorOnly = await discovery.discoverPublishedReleases({ creatorId: 77 });
    assert.deepEqual(creatorOnly.items.map((item) => item.releaseId), ['2', '1']);

    const singles = await discovery.discoverPublishedReleases({ releaseType: 'SINGLE' });
    assert.deepEqual(singles.items.map((item) => item.releaseId), ['2', '3']);

    const recording = await discovery.discoverPublishedReleases({ recordingId: 501 });
    assert.deepEqual(recording.items.map((item) => item.releaseId), ['1']);

    const work = await discovery.discoverPublishedReleases({ workId: 901 });
    assert.deepEqual(work.items.map((item) => item.releaseId), ['1', '3']);

    const bounded = await discovery.discoverPublishedReleases({ limit: 1000 });
    assert.equal(bounded.items.length, 3);

    const creators = await discovery.searchCreators('backstage', 1000);
    assert.deepEqual(creators.map((creator) => creator.creatorId), ['77']);
    assert.equal(creators[0].presentationRevision, '1');
    assert.equal(creators[0].profileManifestHash, '0xprofile');
    assert.deepEqual(await discovery.searchCreators('   '), []);
  } finally {
    await discovery.close();
    await catalog.close();
    await base.close();
  }
});
