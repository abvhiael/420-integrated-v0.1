import test from 'node:test';
import assert from 'node:assert/strict';
import { applyHistoryPage, applySnapshot, applyStreamEvent, createExchangeStore, updateFreshness } from '../core/exchange-store.js';

test('identical snapshot replay is idempotent', () => {
  const store=createExchangeStore();
  const snapshot={marketSubjectId:'m1',snapshotId:'s1',canonicalHead:9,canonicality:'canonical'};
  applySnapshot(store,snapshot);
  applySnapshot(store,snapshot);
  assert.equal(store.snapshots.size,1);
});

test('inactive history remains addressable and marked reorg', () => {
  const store=createExchangeStore();
  applyHistoryPage(store,{records:[{recordId:'r1',subjectId:'m1',active:false}],nextCursor:'c2'});
  assert.equal(store.records.get('r1').recordId,'r1');
  assert.equal(store.canonicality.get('r1'),'reorg');
});

test('reorg and replacement propagate explicitly', () => {
  const store=createExchangeStore();
  applyStreamEvent(store,{sequence:1,kind:'REORG',canonicalHead:10,affectedRecordId:'old',emittedAt:100});
  applyStreamEvent(store,{sequence:2,kind:'REPLACEMENT',canonicalHead:10,affectedRecordId:'old',replacementRecordId:'new',emittedAt:101});
  assert.equal(store.canonicality.get('old'),'reorg');
  assert.equal(store.canonicality.get('new'),'replacement');
  assert.equal(store.replacements.get('old'),'new');
});

test('stream sequence gaps fail closed', () => {
  const store=createExchangeStore();
  applyStreamEvent(store,{sequence:1,kind:'HEARTBEAT',canonicalHead:10,emittedAt:100});
  assert.throws(() => applyStreamEvent(store,{sequence:3,kind:'HEARTBEAT',canonicalHead:10,emittedAt:101}), /sequence gap/);
});

test('freshness transitions to stale after 30 seconds', () => {
  const store=createExchangeStore();
  applyStreamEvent(store,{sequence:1,kind:'HEARTBEAT',canonicalHead:10,emittedAt:100});
  assert.equal(updateFreshness(store,130),'canonical');
  assert.equal(updateFreshness(store,131),'stale');
});
