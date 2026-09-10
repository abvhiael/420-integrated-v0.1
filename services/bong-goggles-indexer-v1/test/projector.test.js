import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesProjector } from '../src/projector.js';

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

function upsert(entityType, entityId, value) {
  return { entityType, entityId, operation: 'UPSERT', value };
}

function del(entityType, entityId) {
  return { entityType, entityId, operation: 'DELETE' };
}

test('deterministic rebuild produces identical state root', () => {
  const events = [
    event({ blockNumber: 10, blockHash: '0xb10', mutations: [upsert('profile', 'alice', { active: true })] }),
    event({ blockNumber: 11, blockHash: '0xb11', mutations: [upsert('post', 'p1', { author: 'alice', bodyHash: '0xabc' })] }),
  ];
  const a = BongGogglesProjector.rebuild({ schemaHash: SCHEMA, chainId: CHAIN, events });
  const b = BongGogglesProjector.rebuild({ schemaHash: SCHEMA, chainId: CHAIN, events });
  assert.equal(a.snapshot().stateRoot, b.snapshot().stateRoot);
  assert.deepEqual(a.exportState(), b.exportState());
});

test('exact duplicate event is idempotent but conflicting identity fails closed', () => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  const e = event({ blockNumber: 10, blockHash: '0xb10', mutations: [upsert('profile', 'alice', { active: true })] });
  projector.applyBatch([e]);
  projector.applyBatch([e]);
  assert.equal(projector.snapshot().eventCount, 1);

  const conflict = structuredClone(e);
  conflict.mutations[0].value.active = false;
  assert.throws(() => projector.applyBatch([conflict]), /conflicting event identity/);
});

test('reorg hash conflict is detected and rollback/replay converges', () => {
  const original = [
    event({ blockNumber: 10, blockHash: '0xb10', mutations: [upsert('profile', 'alice', { active: true })] }),
    event({ blockNumber: 11, blockHash: '0xb11a', mutations: [upsert('post', 'p1', { bodyHash: '0xold' })] }),
  ];
  const projector = BongGogglesProjector.rebuild({ schemaHash: SCHEMA, chainId: CHAIN, events: original });

  const replacement = event({ blockNumber: 11, blockHash: '0xb11b', mutations: [upsert('post', 'p2', { bodyHash: '0xnew' })] });
  assert.throws(() => projector.applyBatch([replacement]), /reorg detected/);

  projector.rollbackTo({ blockNumber: 10, blockHash: '0xb10' });
  projector.applyBatch([replacement]);
  assert.equal(projector.snapshot().indexedBlockHash, '0xb11b');
  assert.equal(projector.exportState().some((x) => x.entityId === 'p1'), false);
  assert.equal(projector.exportState().some((x) => x.entityId === 'p2'), true);
});

test('delete mutations are deterministic and leave no stale projection', () => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([
    event({ blockNumber: 10, blockHash: '0xb10', mutations: [upsert('post', 'p1', { active: true })] }),
    event({ blockNumber: 11, blockHash: '0xb11', mutations: [del('post', 'p1')] }),
  ]);
  assert.equal(projector.exportState().length, 0);
});

test('wrong chain, non-monotonic position and block-hash drift fail closed', () => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  const first = event({ blockNumber: 10, blockHash: '0xb10', logIndex: 1 });
  projector.applyBatch([first]);

  const wrongChain = { ...event({ blockNumber: 11, blockHash: '0xb11' }), chainId: 1 };
  assert.throws(() => projector.applyBatch([wrongChain]), /wrong chain/);

  assert.throws(() => projector.applyBatch([event({ blockNumber: 10, blockHash: '0xb10', logIndex: 0 })]), /non-monotonic/);
  assert.throws(() => projector.applyBatch([event({ blockNumber: 10, blockHash: '0xother', logIndex: 2 })]), /reorg detected/);
});

test('cursor envelope is schema and snapshot bound', () => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([event({ blockNumber: 20, blockHash: '0xb20' })]);

  const cursor = projector.cursorEnvelope({
    viewer: '0xalice',
    searchClass: 'POSTS',
    queryHash: '0xquery',
    filtersHash: '0xfilters',
    snapshotBlock: 20,
    position: 5,
    rankerId: 'recent-v1',
    canonicalCursorDigest: '0xonchain-cursor-digest',
  });
  assert.equal(cursor.schemaHash, SCHEMA);
  assert.equal(cursor.snapshotBlock, 20);
  assert.ok(cursor.backendDigest.length > 0);
  assert.throws(() => projector.cursorEnvelope({ queryHash: '0xq', snapshotBlock: 21, position: 0, rankerId: 'r' }), /ahead of index/);
});
