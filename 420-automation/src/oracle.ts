import type { AutomationOracleObservation420, AutomationOracleResultObservation420 } from './scheduler.js';

export const AUTOMATION_ORACLE_FEED_TYPE_420 = '420/ORACLE/FEED/AUTOMATION/V1';

export interface AutomationOracleConsumerPolicy420 {
  expectedChainId: bigint;
  routerRef: string;
  minConfidenceBps: number;
  minSources: number;
  maxReadAgeMs: number;
  maxSpreadBps: number;
}

export interface AutomationCanonicalNumericRead420 {
  canonical: true;
  chainId: bigint;
  routerRef: string;
  feedId: string;
  feedType: typeof AUTOMATION_ORACLE_FEED_TYPE_420;
  aggregation: 'MEDIAN_NUMERIC';
  value: bigint;
  updatedAtSec: bigint;
  decimals: number;
  confidenceBps: number;
  spreadBps: number;
  sourceCount: number;
}

export interface AutomationCanonicalResultRead420 {
  canonical: true;
  chainId: bigint;
  routerRef: string;
  feedId: string;
  feedType: typeof AUTOMATION_ORACLE_FEED_TYPE_420;
  aggregation: 'QUORUM_EQUAL';
  resultHash: string;
  updatedAtSec: bigint;
  confidenceBps: number;
  agreeingSources: number;
}

export interface AutomationOracleProvenance420 {
  source: '420OracleRouter';
  canonical: true;
  providerNeutral: true;
  routerRef: string;
  chainId: bigint;
  feedId: string;
  feedType: typeof AUTOMATION_ORACLE_FEED_TYPE_420;
  aggregation: 'MEDIAN_NUMERIC' | 'QUORUM_EQUAL';
  sourceCount: number;
  confidenceBps: number;
  spreadBps: number | null;
}

const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const MAX_SOURCES = 16;

function validatePolicy420(policy: AutomationOracleConsumerPolicy420): void {
  if (policy.expectedChainId !== 420n) throw new Error('AUT8_POLICY_CHAIN_INVALID');
  if (policy.routerRef.length === 0 || policy.routerRef.length > 256) throw new Error('AUT8_ROUTER_REF_INVALID');
  if (!Number.isSafeInteger(policy.minConfidenceBps) || policy.minConfidenceBps < 0 || policy.minConfidenceBps > 10_000) throw new Error('AUT8_CONFIDENCE_POLICY_INVALID');
  if (!Number.isSafeInteger(policy.minSources) || policy.minSources <= 0 || policy.minSources > MAX_SOURCES) throw new Error('AUT8_SOURCE_POLICY_INVALID');
  if (!Number.isSafeInteger(policy.maxReadAgeMs) || policy.maxReadAgeMs <= 0) throw new Error('AUT8_MAX_AGE_INVALID');
  if (!Number.isSafeInteger(policy.maxSpreadBps) || policy.maxSpreadBps < 0 || policy.maxSpreadBps > 65_535) throw new Error('AUT8_SPREAD_POLICY_INVALID');
}

function exactKeys420(value: object, allowed: readonly string[]): void {
  const set = new Set(allowed);
  for (const key of Object.keys(value)) if (!set.has(key)) throw new Error('AUT8_READ_FIELD_UNKNOWN');
}

function validateCommon420(input: AutomationCanonicalNumericRead420 | AutomationCanonicalResultRead420, policy: AutomationOracleConsumerPolicy420, nowMs: number): number {
  validatePolicy420(policy);
  if (input.canonical !== true) throw new Error('AUT8_CANONICAL_READ_REQUIRED');
  if (input.chainId !== policy.expectedChainId) throw new Error('AUT8_CHAIN_ID_MISMATCH');
  if (input.routerRef !== policy.routerRef) throw new Error('AUT8_ROUTER_MISMATCH');
  if (input.feedType !== AUTOMATION_ORACLE_FEED_TYPE_420) throw new Error('AUT8_FEED_TYPE_INVALID');
  if (!ID.test(input.feedId)) throw new Error('AUT8_FEED_ID_INVALID');
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('AUT8_NOW_INVALID');
  if (input.updatedAtSec < 0n || input.updatedAtSec > BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 1000))) throw new Error('AUT8_UPDATED_AT_INVALID');
  const updatedAtMs = Number(input.updatedAtSec) * 1000;
  if (updatedAtMs > nowMs) throw new Error('AUT8_READ_FROM_FUTURE');
  if (nowMs - updatedAtMs > policy.maxReadAgeMs) throw new Error('AUT8_READ_STALE');
  if (!Number.isSafeInteger(input.confidenceBps) || input.confidenceBps < policy.minConfidenceBps || input.confidenceBps > 10_000) throw new Error('AUT8_CONFIDENCE_INSUFFICIENT');
  return updatedAtMs;
}

function fixed420(value: bigint, decimals: number): string {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 77) throw new Error('AUT8_DECIMALS_INVALID');
  if (decimals === 0) return value.toString(10);
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString(10).padStart(decimals + 1, '0');
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  const result = fraction ? `${whole}.${fraction}` : whole;
  return negative && result !== '0' ? `-${result}` : result;
}

export function consumeCanonicalAutomationNumericRead420(input: AutomationCanonicalNumericRead420, policy: AutomationOracleConsumerPolicy420, nowMs: number): { observation: AutomationOracleObservation420; provenance: AutomationOracleProvenance420 } {
  exactKeys420(input, ['canonical', 'chainId', 'routerRef', 'feedId', 'feedType', 'aggregation', 'value', 'updatedAtSec', 'decimals', 'confidenceBps', 'spreadBps', 'sourceCount']);
  if (input.aggregation !== 'MEDIAN_NUMERIC') throw new Error('AUT8_AGGREGATION_INVALID');
  const observedAtMs = validateCommon420(input, policy, nowMs);
  if (!Number.isSafeInteger(input.sourceCount) || input.sourceCount < policy.minSources || input.sourceCount > MAX_SOURCES) throw new Error('AUT8_QUORUM_INSUFFICIENT');
  if (!Number.isSafeInteger(input.spreadBps) || input.spreadBps < 0 || input.spreadBps > policy.maxSpreadBps) throw new Error('AUT8_SPREAD_EXCEEDED');
  return {
    observation: { feedId: input.feedId, value: fixed420(input.value, input.decimals), observedAtMs },
    provenance: { source: '420OracleRouter', canonical: true, providerNeutral: true, routerRef: input.routerRef, chainId: input.chainId, feedId: input.feedId, feedType: AUTOMATION_ORACLE_FEED_TYPE_420, aggregation: input.aggregation, sourceCount: input.sourceCount, confidenceBps: input.confidenceBps, spreadBps: input.spreadBps },
  };
}

export function consumeCanonicalAutomationResultRead420(input: AutomationCanonicalResultRead420, policy: AutomationOracleConsumerPolicy420, nowMs: number): { observation: AutomationOracleResultObservation420; provenance: AutomationOracleProvenance420 } {
  exactKeys420(input, ['canonical', 'chainId', 'routerRef', 'feedId', 'feedType', 'aggregation', 'resultHash', 'updatedAtSec', 'confidenceBps', 'agreeingSources']);
  if (input.aggregation !== 'QUORUM_EQUAL') throw new Error('AUT8_AGGREGATION_INVALID');
  const observedAtMs = validateCommon420(input, policy, nowMs);
  if (!HASH32.test(input.resultHash)) throw new Error('AUT8_RESULT_HASH_INVALID');
  if (!Number.isSafeInteger(input.agreeingSources) || input.agreeingSources < policy.minSources || input.agreeingSources > MAX_SOURCES) throw new Error('AUT8_QUORUM_INSUFFICIENT');
  return {
    observation: { feedId: input.feedId, resultHash: input.resultHash.toLowerCase(), observedAtMs },
    provenance: { source: '420OracleRouter', canonical: true, providerNeutral: true, routerRef: input.routerRef, chainId: input.chainId, feedId: input.feedId, feedType: AUTOMATION_ORACLE_FEED_TYPE_420, aggregation: input.aggregation, sourceCount: input.agreeingSources, confidenceBps: input.confidenceBps, spreadBps: null },
  };
}
