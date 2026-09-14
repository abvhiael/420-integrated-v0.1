import test from 'node:test';
import assert from 'node:assert/strict';
import { INDEXER_API_CONSUMERS_420, INDEXER_V1_ROUTES_420 } from '../src/api-contract.js';

test('IDX-7 consumer route contract is unique, GET-only and chain scoped where required', () => {
  const ids = INDEXER_V1_ROUTES_420.map((route) => route.id);
  const paths = INDEXER_V1_ROUTES_420.map((route) => route.path);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(INDEXER_V1_ROUTES_420.every((route) => route.method === 'GET'));
  assert.deepEqual(
    INDEXER_V1_ROUTES_420.filter((route) => route.scope === 'global').map((route) => route.id),
    ['health', 'version']
  );
  assert.ok(INDEXER_V1_ROUTES_420.filter((route) => route.scope === 'chain').every((route) => route.path.length > 0));
});

test('IDX-7 contract names the first-party consumers that bind to the stable public surface', () => {
  assert.deepEqual(INDEXER_API_CONSUMERS_420, [
    '420Explorer',
    '420Search',
    '420Analytics',
    '420Wallet',
    '420Notifications',
    'Developer Hub'
  ]);
});
