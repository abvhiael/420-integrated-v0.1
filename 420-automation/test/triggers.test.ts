import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAutomationTrigger420, validateTriggerBinding420 } from '../src/triggers.js';

const ADDRESS = '0x1111111111111111111111111111111111111111';
const TOPIC0 = `0x${'22'.repeat(32)}`;
const TOPIC1 = `0x${'33'.repeat(32)}`;

test('normalizes one-shot and interval time triggers deterministically', () => {
  const once = normalizeAutomationTrigger420({ kind: 'time', mode: 'once', atMs: 1_000 });
  assert.equal(once.triggerClass, 'time');
  assert.equal(once.canonical, 'time|once|1000');
  assert.match(once.triggerRef, /^0x[0-9a-f]{64}$/);

  const interval = normalizeAutomationTrigger420({ kind: 'time', mode: 'interval', startAtMs: 1_000, intervalMs: 60_000 });
  assert.equal(interval.canonical, 'time|interval|1000|60000');
});

test('normalizes cron whitespace without changing schedule identity', () => {
  const a = normalizeAutomationTrigger420({ kind: 'time', mode: 'cron', expression: '*/5 * * * *' });
  const b = normalizeAutomationTrigger420({ kind: 'time', mode: 'cron', expression: '  */5   * * * *  ' });
  assert.equal(a.triggerRef, b.triggerRef);
  assert.equal(a.canonical, 'time|cron|*/5 * * * *');
});

test('normalizes block triggers using bigint-safe material', () => {
  const trigger = normalizeAutomationTrigger420({ kind: 'block', startBlock: 420n, intervalBlocks: 42n });
  assert.equal(trigger.canonical, 'block|420|42');
});

test('normalizes event filters with lowercased address/topics and wildcard positions', () => {
  const trigger = normalizeAutomationTrigger420({
    kind: 'event',
    address: ADDRESS.toUpperCase().replace('0X', '0x'),
    topic0: TOPIC0.toUpperCase().replace('0X', '0x'),
    topics: [TOPIC1, null],
    minConfirmations: 3,
  });
  assert.equal(trigger.triggerClass, 'event');
  assert.equal(trigger.canonical, `event|${ADDRESS}|${TOPIC0}|${TOPIC1},*|3`);
});

test('normalizes oracle thresholds and keeps oracle data as eligibility facts', () => {
  const a = normalizeAutomationTrigger420({ kind: 'oracle', feedId: 'price.420-usd', predicate: 'gte', threshold: '4.2000', maxAgeMs: 30_000 });
  const b = normalizeAutomationTrigger420({ kind: 'oracle', feedId: 'price.420-usd', predicate: 'gte', threshold: '4.2', maxAgeMs: 30_000 });
  assert.equal(a.triggerRef, b.triggerRef);
  assert.equal(a.canonical, 'oracle|price.420-usd|gte|4.2|30000');
});

test('normalizes manual policy without granting execution authority', () => {
  const trigger = normalizeAutomationTrigger420({ kind: 'manual', requesterPolicy: 'either' });
  assert.equal(trigger.canonical, 'manual|either');
});

test('rejects unknown trigger fields and execution-authority smuggling', () => {
  assert.throws(() => normalizeAutomationTrigger420({ kind: 'manual', requesterPolicy: 'owner', extra: true }), /AUT2_TRIGGER_FIELD_UNKNOWN/);
  assert.throws(() => normalizeAutomationTrigger420({ kind: 'manual', requesterPolicy: 'owner', target: ADDRESS }), /AUT2_EXECUTION_AUTHORITY_SMUGGLING/);
  assert.throws(() => normalizeAutomationTrigger420({ kind: 'oracle', feedId: 'feed', predicate: 'gte', threshold: '1', maxAgeMs: 10, gasLimit: 1 }), /AUT2_EXECUTION_AUTHORITY_SMUGGLING/);
});

test('rejects malformed trigger-specific bounds', () => {
  assert.throws(() => normalizeAutomationTrigger420({ kind: 'time', mode: 'interval', startAtMs: 0, intervalMs: 0 }), /AUT2_TIME_INTERVAL_INVALID/);
  assert.throws(() => normalizeAutomationTrigger420({ kind: 'block', startBlock: 0n, intervalBlocks: 0n }), /AUT2_BLOCK_INTERVAL_INVALID/);
  assert.throws(() => normalizeAutomationTrigger420({ kind: 'event', address: '0x1234', topic0: TOPIC0, minConfirmations: 0 }), /AUT2_EVENT_ADDRESS_INVALID/);
  assert.throws(() => normalizeAutomationTrigger420({ kind: 'oracle', feedId: 'feed', predicate: 'gte', threshold: '01', maxAgeMs: 1 }), /AUT2_ORACLE_THRESHOLD_INVALID/);
  assert.throws(() => normalizeAutomationTrigger420({ kind: 'manual', requesterPolicy: 'anyone' }), /AUT2_MANUAL_POLICY_INVALID/);
});

test('validates registered trigger class/ref binding exactly', () => {
  const input = { kind: 'block', startBlock: 420n, intervalBlocks: 42n } as const;
  const normalized = normalizeAutomationTrigger420(input);
  assert.deepEqual(validateTriggerBinding420({ triggerClass: normalized.triggerClass, triggerRef: normalized.triggerRef, trigger: input }), normalized);
  assert.throws(() => validateTriggerBinding420({ triggerClass: 'time', triggerRef: normalized.triggerRef, trigger: input }), /AUT2_TRIGGER_CLASS_MISMATCH/);
  assert.throws(() => validateTriggerBinding420({ triggerClass: 'block', triggerRef: `0x${'00'.repeat(32)}`, trigger: input }), /AUT2_TRIGGER_REF_MISMATCH/);
});
