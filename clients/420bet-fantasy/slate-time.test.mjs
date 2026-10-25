import test from 'node:test';
import assert from 'node:assert/strict';
import {cutoffForSlate} from './slate-time.mjs';
const time = iso => Date.parse(iso) / 1000;

test('ordinary slate freezes exclusive midnight after the next Eastern day', () => {
  const value = cutoffForSlate([time('2026-10-24T23:00:00Z')]);
  assert.equal(value.exclusiveUTC, '2026-10-26T04:00:00.000Z');
});
test('spring DST permits a correct cutoff less than 24 elapsed hours away', () => {
  const last = time('2026-03-08T04:30:00Z');
  const value = cutoffForSlate([last]);
  assert.equal(value.exclusiveUTC, '2026-03-09T04:00:00.000Z');
  assert.equal(value.cutoff - last, 23.5 * 3600);
});
test('fall DST permits a correct cutoff more than 48 elapsed hours away', () => {
  const last = time('2026-10-31T04:30:00Z');
  const value = cutoffForSlate([last]);
  assert.equal(value.exclusiveUTC, '2026-11-02T05:00:00.000Z');
  assert.equal(value.cutoff - last, 48.5 * 3600);
});
test('original latest game determines the date even when UTC and Eastern dates differ', () => {
  const value = cutoffForSlate([time('2026-10-25T02:00:00Z'), time('2026-10-24T23:00:00Z')]);
  assert.equal(value.exclusiveUTC, '2026-10-26T04:00:00.000Z');
});
test('calendar rollover uses IANA dates rather than adding 48 elapsed hours', () => {
  assert.equal(cutoffForSlate([time('2026-12-31T23:00:00Z')]).exclusiveUTC, '2027-01-02T05:00:00.000Z');
});
test('malformed and multi-day slates are rejected before publication', () => {
  for (const starts of [[], [0], [NaN], ['1'], [1, 86402]]) assert.throws(() => cutoffForSlate(starts));
});
