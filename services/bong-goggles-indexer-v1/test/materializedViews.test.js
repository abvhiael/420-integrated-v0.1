import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesProjector } from '../src/projector.js';
import {
  profileMutation,
  socialObjectMutation,
  relationshipMutation,
  deleteRelationshipMutation,
  feedEntryMutation,
  materializeState,
  visibleFeed,
} from '../src/materializedViews.js';

const SCHEMA = '0xsearch-schema-v1';
const CHAIN = 420;

function event({ blockNumber, blockHash, transactionIndex = 0, logIndex = 0, name = 'Changed', mutations = [] }) {
  return {
    chainId: CHAIN,
    blockNumber,
    blockHash,
    transactionIndex,
    transactionHash: `0xtx-${blockNumber}-${transactionIndex}`,
    logIndex,
    eventName: name,
    mutations,
  };
}

test('materializes profiles, objects, relationships and ordered feeds', () => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([
    event({ blockNumber: 10, blockHash: '0xb10', mutations: [
      profileMutation({ account: '0xALICE', active: true, profileType: 'PERSON' }),
      socialObjectMutation({ objectId: 'p1', author: '0xALICE', objectType: 'STATUS', status: 'ACTIVE', audienceType: 'PUBLIC', contentHash: '0x1', version: 1 }),
      relationshipMutation({ relationshipType: 'FOLLOW', from: '0xBOB', to: '0xALICE', status: 'ACTIVE' }),
      feedEntryMutation({ feedClass: 'FOLLOWING', viewerKey: '0xBOB', objectId: 'p1', rankKey: '0002' }),
    ]}),
    event({ blockNumber: 11, blockHash: '0xb11', mutations: [
      socialObjectMutation({ objectId: 'p2', author: '0xALICE', objectType: 'PHOTO_POST', status: 'ACTIVE', audienceType: 'PUBLIC', contentHash: '0x2', version: 1 }),
      feedEntryMutation({ feedClass: 'FOLLOWING', viewerKey: '0xBOB', objectId: 'p2', rankKey: '0003' }),
    ]}),
  ]);

  const view = materializeState(projector);
  assert.equal(view.profiles.get('0xalice').active, true);
  assert.equal(view.socialObjects.get('p2').objectType, 'PHOTO_POST');
  assert.equal(view.relationships.length, 1);
  assert.deepEqual(visibleFeed(view, { feedClass: 'FOLLOWING', viewerKey: '0xBOB' }).map((x) => x.objectId), ['p2', 'p1']);
});

test('inactive authors and inactive objects are excluded from visible feed', () => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([
    event({ blockNumber: 10, blockHash: '0xb10', mutations: [
      profileMutation({ account: '0xalice', active: true }),
      socialObjectMutation({ objectId: 'p1', author: '0xalice', status: 'ACTIVE' }),
      feedEntryMutation({ feedClass: 'HOME', objectId: 'p1', rankKey: '1' }),
    ]}),
    event({ blockNumber: 11, blockHash: '0xb11', mutations: [
      profileMutation({ account: '0xalice', active: false }),
    ]}),
  ]);
  assert.deepEqual(visibleFeed(materializeState(projector), { feedClass: 'HOME' }), []);

  const replacement = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  replacement.applyBatch([
    event({ blockNumber: 10, blockHash: '0xb10', mutations: [
      profileMutation({ account: '0xalice', active: true }),
      socialObjectMutation({ objectId: 'p1', author: '0xalice', status: 'DELETED' }),
      feedEntryMutation({ feedClass: 'HOME', objectId: 'p1', rankKey: '1' }),
    ]}),
  ]);
  assert.deepEqual(visibleFeed(materializeState(replacement), { feedClass: 'HOME' }), []);
});

test('relationship delete removes stale edge deterministically', () => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([
    event({ blockNumber: 10, blockHash: '0xb10', mutations: [relationshipMutation({ relationshipType: 'FRIEND', from: '0xa', to: '0xb', status: 'ACTIVE' })] }),
    event({ blockNumber: 11, blockHash: '0xb11', mutations: [deleteRelationshipMutation({ relationshipType: 'FRIEND', from: '0xa', to: '0xb' })] }),
  ]);
  assert.equal(materializeState(projector).relationships.length, 0);
});

test('feed eligibility deletion removes entry and rebuild view digest is stable', () => {
  const events = [
    event({ blockNumber: 10, blockHash: '0xb10', mutations: [
      profileMutation({ account: '0xalice', active: true }),
      socialObjectMutation({ objectId: 'p1', author: '0xalice', status: 'ACTIVE' }),
      feedEntryMutation({ feedClass: 'DISCOVER', objectId: 'p1', rankKey: '9' }),
    ]}),
    event({ blockNumber: 11, blockHash: '0xb11', mutations: [feedEntryMutation({ feedClass: 'DISCOVER', objectId: 'p1', eligible: false })] }),
  ];
  const a = BongGogglesProjector.rebuild({ schemaHash: SCHEMA, chainId: CHAIN, events });
  const b = BongGogglesProjector.rebuild({ schemaHash: SCHEMA, chainId: CHAIN, events });
  const av = materializeState(a);
  const bv = materializeState(b);
  assert.deepEqual(visibleFeed(av, { feedClass: 'DISCOVER' }), []);
  assert.equal(av.viewDigest, bv.viewDigest);
});

test('materialized checkpoint follows projector reorg rollback and replay', () => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([
    event({ blockNumber: 10, blockHash: '0xb10', mutations: [profileMutation({ account: '0xalice', active: true })] }),
    event({ blockNumber: 11, blockHash: '0xb11a', mutations: [socialObjectMutation({ objectId: 'old', author: '0xalice', status: 'ACTIVE' })] }),
  ]);
  projector.rollbackTo({ blockNumber: 10, blockHash: '0xb10' });
  projector.applyBatch([event({ blockNumber: 11, blockHash: '0xb11b', mutations: [socialObjectMutation({ objectId: 'new', author: '0xalice', status: 'ACTIVE' })] })]);
  const view = materializeState(projector);
  assert.equal(view.checkpoint.indexedBlockHash, '0xb11b');
  assert.equal(view.socialObjects.has('old'), false);
  assert.equal(view.socialObjects.has('new'), true);
});
