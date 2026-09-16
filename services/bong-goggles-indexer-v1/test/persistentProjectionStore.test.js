import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BongGogglesProjector } from '../src/projector.js';
import { profileMutation, socialObjectMutation } from '../src/materializedViews.js';
import { PersistentProjectionStore } from '../src/persistentProjectionStore.js';

const SCHEMA = '0xsearch-schema-v1';
const CHAIN = 420;

function event(blockNumber, blockHash, logIndex, mutations) {
  return {
    chainId: CHAIN,
    blockNumber,
    blockHash,
    transactionIndex: 0,
    transactionHash: `0xtx-${blockNumber}`,
    logIndex,
    eventName: 'Changed',
    mutations,
  };
}

function withStore(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-indexer-'));
  try { return fn(new PersistentProjectionStore(path.join(dir, 'projection.json')), dir); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('save/load rebuilds and verifies the exact state root', () => withStore((store) => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([
    event(10, '0xb10', 0, [profileMutation({ account: '0xalice', active: true })]),
    event(11, '0xb11', 0, [socialObjectMutation({ objectId: 'p1', author: '0xalice', status: 'ACTIVE', version: 1 })]),
  ]);
  store.save(projector);
  const loaded = store.load({ schemaHash: SCHEMA, chainId: CHAIN });
  assert.equal(loaded.snapshot().stateRoot, projector.snapshot().stateRoot);
  assert.deepEqual(loaded.exportState(), projector.exportState());
}));

test('schema and chain mismatches fail closed', () => withStore((store) => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([event(10, '0xb10', 0, [])]);
  store.save(projector);
  assert.throws(() => store.load({ schemaHash: '0xother', chainId: CHAIN }), /schema mismatch/);
  assert.throws(() => store.load({ schemaHash: SCHEMA, chainId: 1 }), /chain mismatch/);
}));

test('tampered persisted event stream is rejected', () => withStore((store) => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([event(10, '0xb10', 0, [])]);
  store.save(projector);
  const raw = JSON.parse(fs.readFileSync(store.filePath, 'utf8'));
  raw.events[0].blockHash = '0xtampered';
  fs.writeFileSync(store.filePath, JSON.stringify(raw));
  assert.throws(() => store.load({ schemaHash: SCHEMA, chainId: CHAIN }), /event stream digest mismatch/);
}));

test('recovery keeps canonical checkpoint when head hash still matches', () => withStore((store) => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([event(10, '0xb10', 0, []), event(11, '0xb11', 0, [])]);
  store.save(projector);
  const result = store.recover({ schemaHash: SCHEMA, chainId: CHAIN, canonicalBlockHash: (block) => `0xb${block}` });
  assert.equal(result.reorg, false);
  assert.equal(result.projector.snapshot().indexedBlock, 11);
}));

test('recovery rolls back to last matching canonical block on reorg', () => withStore((store) => {
  const projector = new BongGogglesProjector({ schemaHash: SCHEMA, chainId: CHAIN });
  projector.applyBatch([
    event(10, '0xb10', 0, [profileMutation({ account: '0xalice', active: true })]),
    event(11, '0xb11-old', 0, [socialObjectMutation({ objectId: 'old', author: '0xalice', status: 'ACTIVE', version: 1 })]),
  ]);
  store.save(projector);
  const canonical = new Map([[10, '0xb10'], [11, '0xb11-new']]);
  const result = store.recover({ schemaHash: SCHEMA, chainId: CHAIN, canonicalBlockHash: (block) => canonical.get(block) ?? null });
  assert.equal(result.reorg, true);
  assert.equal(result.rollbackBlock, 10);
  assert.equal(result.projector.snapshot().indexedBlock, 10);
  assert.equal(result.projector.exportState().some((row) => row.entityId === 'old'), false);
}));
