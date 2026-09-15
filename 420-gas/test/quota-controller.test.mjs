import assert from 'node:assert/strict';
import test from 'node:test';
import { GasQuotaController420, GasQuotaError420 } from '../src/quota-controller.mjs';

const addr = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const hash = (n) => `0x${n.toString(16).padStart(64, '0')}`;

function controller(overrides = {}) {
  return new GasQuotaController420({
    windowMs: 1_000,
    maxSponsoredCostPerOperationWei: 100n,
    maxAccountWindowWei: 200n,
    maxPolicyWindowWei: 300n,
    maxAccountOperationsPerWindow: 2,
    maxPolicyOperationsPerWindow: 3,
    maxConcurrentPerAccount: 2,
    maxTrackedAuthorizations: 4,
    ...overrides,
  });
}

function reserve(q, n, overrides = {}) {
  return q.reserve({
    account: addr(1),
    policyId: hash(2),
    authorizationId: hash(n),
    maxSponsoredCostWei: 100n,
    nowMs: 100,
    ...overrides,
  });
}

test('GAS-9.1 reserves bounded sponsorship without granting execution authority', () => {
  const q = controller();
  const r = reserve(q, 10);
  assert.equal(r.reservedWei, 100n);
  assert.deepEqual(Object.keys(r).sort(), ['account', 'authorizationId', 'policyId', 'reservedWei', 'windowId'].sort());
  const s = q.snapshot({ account: addr(1), policyId: hash(2), nowMs: 100 });
  assert.equal(s.accountOperations, 1);
  assert.equal(s.accountSponsoredWei, 100n);
  assert.equal(s.accountConcurrent, 1);
});

test('GAS-9.1 rejects operation cost and duplicate authorization abuse', () => {
  const q = controller();
  assert.throws(() => reserve(q, 10, { maxSponsoredCostWei: 101n }), /GAS9_OPERATION_COST_EXCEEDED/);
  reserve(q, 10);
  assert.throws(() => reserve(q, 10), /GAS9_DUPLICATE_AUTHORIZATION/);
});

test('GAS-9.1 enforces per-account spend, operation and concurrency quotas', () => {
  const q = controller();
  reserve(q, 10);
  reserve(q, 11);
  assert.throws(() => reserve(q, 12), /GAS9_ACCOUNT_OPERATION_QUOTA_EXCEEDED|GAS9_ACCOUNT_CONCURRENCY_EXCEEDED/);

  const spend = controller({ maxAccountOperationsPerWindow: 10, maxConcurrentPerAccount: 10, maxAccountWindowWei: 150n });
  reserve(spend, 20);
  assert.throws(() => reserve(spend, 21), /GAS9_ACCOUNT_SPEND_QUOTA_EXCEEDED/);

  const concurrent = controller({ maxAccountOperationsPerWindow: 10, maxAccountWindowWei: 1_000n, maxConcurrentPerAccount: 1 });
  reserve(concurrent, 30);
  assert.throws(() => reserve(concurrent, 31), /GAS9_ACCOUNT_CONCURRENCY_EXCEEDED/);
  assert.equal(concurrent.release(hash(30)), true);
  reserve(concurrent, 31);
});

test('GAS-9.1 enforces policy-wide quotas across accounts', () => {
  const q = controller({ maxAccountOperationsPerWindow: 10, maxAccountWindowWei: 1_000n, maxConcurrentPerAccount: 10, maxPolicyOperationsPerWindow: 2, maxPolicyWindowWei: 1_000n });
  reserve(q, 10, { account: addr(1) });
  reserve(q, 11, { account: addr(2) });
  assert.throws(() => reserve(q, 12, { account: addr(3) }), /GAS9_POLICY_OPERATION_QUOTA_EXCEEDED/);

  const spend = controller({ maxAccountOperationsPerWindow: 10, maxAccountWindowWei: 1_000n, maxConcurrentPerAccount: 10, maxPolicyOperationsPerWindow: 10, maxPolicyWindowWei: 150n });
  reserve(spend, 20, { account: addr(1) });
  assert.throws(() => reserve(spend, 21, { account: addr(2) }), /GAS9_POLICY_SPEND_QUOTA_EXCEEDED/);
});

test('GAS-9.1 resets rolling quota counters at the next fixed window while active concurrency remains explicit', () => {
  const q = controller({ maxAccountOperationsPerWindow: 1, maxConcurrentPerAccount: 10 });
  reserve(q, 10, { nowMs: 100 });
  assert.throws(() => reserve(q, 11, { nowMs: 900 }), /GAS9_ACCOUNT_OPERATION_QUOTA_EXCEEDED/);
  reserve(q, 11, { nowMs: 1_100 });
  const s = q.snapshot({ account: addr(1), policyId: hash(2), nowMs: 1_100 });
  assert.equal(s.accountOperations, 1);
  assert.equal(s.accountConcurrent, 2);
});

test('GAS-9.1 bounds tracked outstanding authorization state', () => {
  const q = controller({ maxAccountOperationsPerWindow: 100, maxPolicyOperationsPerWindow: 100, maxAccountWindowWei: 10_000n, maxPolicyWindowWei: 10_000n, maxConcurrentPerAccount: 100, maxTrackedAuthorizations: 2 });
  reserve(q, 10);
  reserve(q, 11, { account: addr(2) });
  assert.throws(() => reserve(q, 12, { account: addr(3) }), /GAS9_STATE_CAPACITY_EXCEEDED/);
  q.release(hash(10));
  reserve(q, 12, { account: addr(3) });
});

test('GAS-9.1 validates quota configuration and malformed reservation keys', () => {
  assert.throws(() => new GasQuotaController420({ windowMs: 0 }), GasQuotaError420);
  const q = controller();
  assert.throws(() => reserve(q, 10, { account: '' }), /GAS9_ACCOUNT_INVALID/);
  assert.throws(() => reserve(q, 10, { maxSponsoredCostWei: 0n }), /GAS9_OPERATION_COST_INVALID/);
});
