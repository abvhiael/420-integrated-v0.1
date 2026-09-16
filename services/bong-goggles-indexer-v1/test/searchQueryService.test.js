import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesProjector } from '../src/projector.js';
import { BongGogglesSearchQueryService } from '../src/searchQueryService.js';

const SCHEMA = '0xsearch-schema-v1';
const CHAIN = 420;

function event(blockNumber, logIndex, mutations) {
  return {
    chainId: CHAIN,
    blockNumber,
    blockHash: `0xb${blockNumber}`,
    transactionIndex: 0,
    transactionHash: `0xtx-${blockNumber}`,
    logIndex,
    eventName: 'ProjectionChanged',
    mutations,
  };
}

function upsert(entityType, entityId, value) {
  return { entityType, entityId, operation:'UPSERT', value };
}

function fixture() {
  const projector = new BongGogglesProjector({ schemaHash:SCHEMA, chainId:CHAIN });
  projector.applyBatch([
    event(10,0,[upsert('profile','0xalice',{account:'0xalice',active:true,handleHash:'alice',updatedAt:10})]),
    event(11,0,[upsert('profile','0xbob',{account:'0xbob',active:true,handleHash:'bob',updatedAt:11})]),
    event(12,0,[upsert('page','page1',{pageId:'page1',profileAccount:'0xalice',owner:'0xalice',metadataRoot:'alice-page',active:true,updatedAt:12})]),
    event(13,0,[upsert('group','group1',{groupId:'group1',owner:'0xalice',metadataRoot:'growers',active:true,updatedAt:13})]),
    event(14,0,[upsert('socialObject','post1',{objectId:'post1',author:'0xalice',objectType:'STATUS',status:'ACTIVE',contentHash:'hello-world',updatedAt:14})]),
    event(15,0,[upsert('socialObject','collection1',{objectId:'collection1',author:'0xalice',objectType:'COLLECTION',status:'ACTIVE',contentHash:'collection',updatedAt:15})]),
    event(16,0,[upsert('discoverySubject','place1',{subjectId:'place1',subjectType:'PLACE',canonicalRef:'dispensary',status:'ACTIVE',updatedAt:16})]),
    event(17,0,[upsert('event','event1',{eventId:'event1',owner:'0xalice',metadataRoot:'expo',active:true,updatedAt:17})]),
  ]);
  return projector;
}

test('search classifies projection entities and canonically revalidates every result', async () => {
  const calls = [];
  const service = new BongGogglesSearchQueryService({
    projector: fixture(),
    canonicalEligibility: async (context) => {
      calls.push(context);
      return context.candidate.entityId !== '0xbob';
    },
    canonicalCursorDigest: async () => '0xcanonical-cursor',
    clock: () => 1234,
  });
  const result = await service.search({ searchClass:'PEOPLE', query:'', rankerId:'rank-v1', limit:10 });
  assert.deepEqual(result.results.map((x)=>x.entityId), ['0xalice']);
  assert.equal(calls.length, 2);
  assert.equal(result.cursor.canonicalCursorDigest, '0xcanonical-cursor');
  assert.equal(result.freshness.indexedBlock, 17);
  assert.equal(result.freshness.observedAt, 1234);
});

test('posts and collections are separated by canonical search class', async () => {
  const service = new BongGogglesSearchQueryService({ projector:fixture(), canonicalEligibility:async()=>true });
  const posts = await service.search({ searchClass:'POSTS', rankerId:'rank-v1' });
  const collections = await service.search({ searchClass:'COLLECTIONS', rankerId:'rank-v1' });
  assert.deepEqual(posts.results.map((x)=>x.entityId), ['post1']);
  assert.deepEqual(collections.results.map((x)=>x.entityId), ['collection1']);
});

test('discovery subjects map to exact canonical discovery search classes', async () => {
  const service = new BongGogglesSearchQueryService({ projector:fixture(), canonicalEligibility:async()=>true });
  const places = await service.search({ searchClass:'PLACES', query:'dispensary', rankerId:'rank-v1' });
  assert.deepEqual(places.results.map((x)=>x.entityId), ['place1']);
  const products = await service.search({ searchClass:'PRODUCTS', rankerId:'rank-v1' });
  assert.equal(products.results.length, 0);
});

test('pagination is snapshot-bound and deterministic', async () => {
  const service = new BongGogglesSearchQueryService({ projector:fixture(), canonicalEligibility:async()=>true });
  const first = await service.search({ searchClass:'PEOPLE', rankerId:'rank-v1', limit:1, position:0 });
  const second = await service.search({ searchClass:'PEOPLE', rankerId:'rank-v1', limit:1, position:first.cursor.position });
  assert.equal(first.results.length, 1);
  assert.equal(first.hasMore, true);
  assert.equal(second.results.length, 1);
  assert.equal(second.hasMore, false);
  assert.equal(first.snapshotBlock, second.snapshotBlock);
});

test('recommendations are canonically filtered and bind candidate set/model/snapshot', async () => {
  const service = new BongGogglesSearchQueryService({
    projector:fixture(),
    canonicalEligibility:async ({candidate}) => candidate.entityId !== '0xbob',
    canonicalRecommendationDigest:async (context) => `canonical:${context.candidateSetHash}`,
  });
  const recommendation = await service.recommend({ searchClass:'PEOPLE', surfaceId:'home-people', modelId:'model-v1', limit:10 });
  assert.deepEqual(recommendation.results.map((x)=>x.entityId), ['0xalice']);
  assert.ok(recommendation.candidateSetHash);
  assert.equal(recommendation.canonicalRecommendationDigest, `canonical:${recommendation.candidateSetHash}`);
  assert.ok(recommendation.backendDigest);
});

test('page/group/community event candidates fail closed when canonical callback denies them', async () => {
  const service = new BongGogglesSearchQueryService({ projector:fixture(), canonicalEligibility:async()=>false });
  for (const searchClass of ['PAGES','GROUPS','EVENTS']) {
    const result = await service.search({ searchClass, rankerId:'rank-v1' });
    assert.equal(result.results.length, 0);
  }
});

test('invalid search class, limit and missing canonical authority fail closed', async () => {
  assert.throws(()=>new BongGogglesSearchQueryService({projector:fixture()}), /canonicalEligibility required/);
  const service = new BongGogglesSearchQueryService({projector:fixture(), canonicalEligibility:async()=>true});
  await assert.rejects(service.search({searchClass:'NOPE',rankerId:'rank-v1'}), /invalid searchClass/);
  await assert.rejects(service.search({searchClass:'PEOPLE',rankerId:'rank-v1',limit:0}), /invalid limit/);
});
