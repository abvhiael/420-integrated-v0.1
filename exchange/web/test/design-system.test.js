import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_META, formatCompactHash, formatTimestamp, statusMeta } from '../core/design-system.js';

test('publishes all qualified Exchange semantic states', () => {
  assert.deepEqual(Object.keys(STATUS_META), [
    'canonical',
    'finalized',
    'stale',
    'reorg',
    'replacement',
    'degraded',
    'routeHealthy',
    'routeUnhealthy',
    'settlementHealthy',
    'settlementUnhealthy',
  ]);
});

test('every semantic state includes non-color meaning', () => {
  for (const meta of Object.values(STATUS_META)) {
    assert.ok(meta.label.length > 0);
    assert.ok(meta.symbol.length > 0);
    assert.ok(meta.description.length > 0);
    assert.ok(['positive', 'warning', 'info', 'danger'].includes(meta.tone));
  }
});

test('unknown status fails closed', () => {
  assert.throws(() => statusMeta('invented-state'), /unknown Exchange status/);
});

test('hash formatting preserves short values and compacts long values', () => {
  assert.equal(formatCompactHash(null), '—');
  assert.equal(formatCompactHash('0x1234'), '0x1234');
  assert.equal(formatCompactHash('0x1234567890abcdef1234567890abcdef'), '0x123456…abcdef');
});

test('invalid timestamp never invents display time', () => {
  assert.equal(formatTimestamp('not-a-date'), '—');
});
