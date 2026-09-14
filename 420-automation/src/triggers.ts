import { createHash } from 'node:crypto';
import type { AutomationTriggerClass420 } from './architecture.js';

export type AutomationTriggerInput420 =
  | { kind: 'time'; mode: 'once'; atMs: number }
  | { kind: 'time'; mode: 'interval'; startAtMs: number; intervalMs: number }
  | { kind: 'time'; mode: 'cron'; expression: string }
  | { kind: 'block'; startBlock: bigint; intervalBlocks: bigint }
  | { kind: 'event'; address: string; topic0: string; topics?: readonly (string | null)[]; minConfirmations: number }
  | { kind: 'oracle'; feedId: string; predicate: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; threshold: string; maxAgeMs: number }
  | { kind: 'oracle'; mode: 'result'; feedId: string; expectedResultHash: string; maxAgeMs: number }
  | { kind: 'manual'; requesterPolicy: 'owner' | 'protocol' | 'either' };

export interface AutomationNormalizedTrigger420 {
  triggerClass: AutomationTriggerClass420;
  triggerRef: string;
  canonical: string;
}

const ADDRESS20 = /^0x[0-9a-fA-F]{40}$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const MAX_CRON_LENGTH = 128;
const MAX_TOPICS = 4;
const FORBIDDEN_TRIGGER_KEYS = new Set(['target', 'selector', 'calldata', 'calldataHash', 'value', 'nativeValueWei', 'gas', 'gasLimit']);

function assertRecord420(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('AUT2_TRIGGER_OBJECT_INVALID');
}

function assertExactKeys420(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_TRIGGER_KEYS.has(key)) throw new Error('AUT2_EXECUTION_AUTHORITY_SMUGGLING');
    if (!allowedSet.has(key)) throw new Error('AUT2_TRIGGER_FIELD_UNKNOWN');
  }
}

function safeNonNegativeInteger420(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(code);
  return value as number;
}

function positiveSafeInteger420(value: unknown, code: string): number {
  const normalized = safeNonNegativeInteger420(value, code);
  if (normalized === 0) throw new Error(code);
  return normalized;
}

function normalizeCron420(expression: unknown): string {
  if (typeof expression !== 'string') throw new Error('AUT2_CRON_INVALID');
  const normalized = expression.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0 || normalized.length > MAX_CRON_LENGTH) throw new Error('AUT2_CRON_INVALID');
  if (normalized.split(' ').length !== 5) throw new Error('AUT2_CRON_FIELDS_INVALID');
  if (!/^[0-9*/?,\- ]+$/.test(normalized)) throw new Error('AUT2_CRON_INVALID');
  return normalized;
}

function normalizeDecimal420(value: unknown): string {
  if (typeof value !== 'string' || !DECIMAL.test(value)) throw new Error('AUT2_ORACLE_THRESHOLD_INVALID');
  if (value === '-0') return '0';
  if (!value.includes('.')) return value;
  const [whole, fraction] = value.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed.length === 0 ? (whole === '-0' ? '0' : whole) : `${whole}.${trimmed}`;
}

function triggerRef420(canonical: string): string {
  return `0x${createHash('sha256').update(`420Automation/trigger/v1|${canonical}`).digest('hex')}`;
}

export function normalizeAutomationTrigger420(input: unknown): AutomationNormalizedTrigger420 {
  assertRecord420(input);
  if (typeof input.kind !== 'string') throw new Error('AUT2_TRIGGER_KIND_INVALID');

  let triggerClass: AutomationTriggerClass420;
  let canonical: string;

  switch (input.kind) {
    case 'time': {
      triggerClass = 'time';
      if (input.mode === 'once') {
        assertExactKeys420(input, ['kind', 'mode', 'atMs']);
        canonical = `time|once|${safeNonNegativeInteger420(input.atMs, 'AUT2_TIME_AT_INVALID')}`;
      } else if (input.mode === 'interval') {
        assertExactKeys420(input, ['kind', 'mode', 'startAtMs', 'intervalMs']);
        canonical = `time|interval|${safeNonNegativeInteger420(input.startAtMs, 'AUT2_TIME_START_INVALID')}|${positiveSafeInteger420(input.intervalMs, 'AUT2_TIME_INTERVAL_INVALID')}`;
      } else if (input.mode === 'cron') {
        assertExactKeys420(input, ['kind', 'mode', 'expression']);
        canonical = `time|cron|${normalizeCron420(input.expression)}`;
      } else {
        throw new Error('AUT2_TIME_MODE_INVALID');
      }
      break;
    }
    case 'block': {
      triggerClass = 'block';
      assertExactKeys420(input, ['kind', 'startBlock', 'intervalBlocks']);
      if (typeof input.startBlock !== 'bigint' || input.startBlock < 0n) throw new Error('AUT2_BLOCK_START_INVALID');
      if (typeof input.intervalBlocks !== 'bigint' || input.intervalBlocks <= 0n) throw new Error('AUT2_BLOCK_INTERVAL_INVALID');
      canonical = `block|${input.startBlock}|${input.intervalBlocks}`;
      break;
    }
    case 'event': {
      triggerClass = 'event';
      assertExactKeys420(input, ['kind', 'address', 'topic0', 'topics', 'minConfirmations']);
      if (typeof input.address !== 'string' || !ADDRESS20.test(input.address)) throw new Error('AUT2_EVENT_ADDRESS_INVALID');
      if (typeof input.topic0 !== 'string' || !HASH32.test(input.topic0)) throw new Error('AUT2_EVENT_TOPIC0_INVALID');
      const topics = input.topics === undefined ? [] : input.topics;
      if (!Array.isArray(topics) || topics.length > MAX_TOPICS) throw new Error('AUT2_EVENT_TOPICS_INVALID');
      const normalizedTopics = topics.map((topic) => {
        if (topic === null) return '*';
        if (typeof topic !== 'string' || !HASH32.test(topic)) throw new Error('AUT2_EVENT_TOPIC_INVALID');
        return topic.toLowerCase();
      });
      const confirmations = safeNonNegativeInteger420(input.minConfirmations, 'AUT2_EVENT_CONFIRMATIONS_INVALID');
      canonical = `event|${input.address.toLowerCase()}|${input.topic0.toLowerCase()}|${normalizedTopics.join(',')}|${confirmations}`;
      break;
    }
    case 'oracle': {
      triggerClass = 'oracle';
      if (input.mode === 'result') {
        assertExactKeys420(input, ['kind', 'mode', 'feedId', 'expectedResultHash', 'maxAgeMs']);
        if (typeof input.feedId !== 'string' || !ID.test(input.feedId)) throw new Error('AUT2_ORACLE_FEED_INVALID');
        if (typeof input.expectedResultHash !== 'string' || !HASH32.test(input.expectedResultHash)) throw new Error('AUT2_ORACLE_RESULT_HASH_INVALID');
        canonical = `oracle-result|${input.feedId}|${input.expectedResultHash.toLowerCase()}|${positiveSafeInteger420(input.maxAgeMs, 'AUT2_ORACLE_MAX_AGE_INVALID')}`;
      } else {
        assertExactKeys420(input, ['kind', 'feedId', 'predicate', 'threshold', 'maxAgeMs']);
        if (typeof input.feedId !== 'string' || !ID.test(input.feedId)) throw new Error('AUT2_ORACLE_FEED_INVALID');
        if (!['eq', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(String(input.predicate))) throw new Error('AUT2_ORACLE_PREDICATE_INVALID');
        canonical = `oracle|${input.feedId}|${String(input.predicate)}|${normalizeDecimal420(input.threshold)}|${positiveSafeInteger420(input.maxAgeMs, 'AUT2_ORACLE_MAX_AGE_INVALID')}`;
      }
      break;
    }
    case 'manual': {
      triggerClass = 'manual';
      assertExactKeys420(input, ['kind', 'requesterPolicy']);
      if (!['owner', 'protocol', 'either'].includes(String(input.requesterPolicy))) throw new Error('AUT2_MANUAL_POLICY_INVALID');
      canonical = `manual|${String(input.requesterPolicy)}`;
      break;
    }
    default:
      throw new Error('AUT2_TRIGGER_KIND_INVALID');
  }

  return { triggerClass, canonical, triggerRef: triggerRef420(canonical) };
}

export function validateTriggerBinding420(input: {
  triggerClass: AutomationTriggerClass420;
  triggerRef: string;
  trigger: unknown;
}): AutomationNormalizedTrigger420 {
  const normalized = normalizeAutomationTrigger420(input.trigger);
  if (normalized.triggerClass !== input.triggerClass) throw new Error('AUT2_TRIGGER_CLASS_MISMATCH');
  if (normalized.triggerRef !== input.triggerRef.toLowerCase()) throw new Error('AUT2_TRIGGER_REF_MISMATCH');
  return normalized;
}
