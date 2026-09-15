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
    maxSponsorWindowWei: 1_000n,
    maxAccountOperationsPerWindow: 2,
    maxPolicyOperationsPerWindow: 3,
    maxSponsorOperationsPerWindow: 10,
    maxConcurrentPerAccount: 2,
    maxConcurrentSponsor: 4,
    maxTrackedAuthorizations: 4,
    maxReservationAgeMs: 5_000,
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
    expiresAtMs: 1_000,
    ...overrides,
  });
}

test('GAS-9.1 reserves bounded sponsorship without granting execution authority', () => {
  const q = controller();
  const r = reserve(q, 10);
  assert.equal(r.reservedWei, 100n);
  assert.equal(r.expiresAtMs, 1_000);
  assert.deepEqual(Object.keys(r).sort(), ['account', 'authorizationId', 'expiresAtMs', 'policyId', 'reservedWei', 'windowId'].sort());
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
  reserve(q, 10, { nowMs: 100, expiresAtMs: 2_000 });
  assert.throws(() => reserve(q, 11, { nowMs: 900, expiresAtMs: 2_000 }), /GAS9_ACCOUNT_OPERATION_QUOTA_EXCEEDED/);
  reserve(q, 11, { nowMs: 1_100, expiresAtMs: 2_000 });
  const s = q.snapshot({ account: addr(1), policyId: hash(2), nowMs: 1_100 });
  assert.equal(s.accountOperations, 1);
  assert.equal(s.accountConcurrent, 2);
});

test('GAS-9.1 bounds tracked outstanding authorization state', () => {
  const q = controller({ maxAccountOperationsPerWindow: 100, maxPolicyOperationsPerWindow: 100, maxAccountWindowWei: 10_000n, maxPolicyWindowWei: 10_000n, maxConcurrentPerAccount: 100, maxConcurrentSponsor: 100, maxTrackedAuthorizations: 2 });
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

test('GAS-9.3 enforces sponsor-wide spend and operation quotas across policies and accounts', () => {
  const spend = controller({
    maxAccountOperationsPerWindow: 100,
    maxPolicyOperationsPerWindow: 100,
    maxSponsorOperationsPerWindow: 100,
    maxAccountWindowWei: 10_000n,
    maxPolicyWindowWei: 10_000n,
    maxSponsorWindowWei: 150n,
    maxConcurrentPerAccount: 100,
    maxConcurrentSponsor: 100,
    maxTrackedAuthorizations: 100,
  });
  reserve(spend, 40, { account: addr(1), policyId: hash(2) });
  assert.throws(() => reserve(spend, 41, { account: addr(2), policyId: hash(3) }), /GAS9_SPONSOR_SPEND_QUOTA_EXCEEDED/);

  const ops = controller({
    maxAccountOperationsPerWindow: 100,
    maxPolicyOperationsPerWindow: 100,
    maxSponsorOperationsPerWindow: 1,
    maxAccountWindowWei: 10_000n,
    maxPolicyWindowWei: 10_000n,
    maxSponsorWindowWei: 10_000n,
    maxConcurrentPerAccount: 100,
    maxConcurrentSponsor: 100,
    maxTrackedAuthorizations: 100,
  });
  reserve(ops, 50, { account: addr(1), policyId: hash(2) });
  assert.throws(() => reserve(ops, 51, { account: addr(2), policyId: hash(3) }), /GAS9_SPONSOR_OPERATION_QUOTA_EXCEEDED/);
});

test('GAS-9.3 caps sponsor-wide outstanding concurrency', () => {
  const q = controller({
    maxAccountOperationsPerWindow: 100,
    maxPolicyOperationsPerWindow: 100,
    maxSponsorOperationsPerWindow: 100,
    maxAccountWindowWei: 10_000n,
    maxPolicyWindowWei: 10_000n,
    maxSponsorWindowWei: 10_000n,
    maxConcurrentPerAccount: 100,
    maxConcurrentSponsor: 2,
    maxTrackedAuthorizations: 100,
  });
  reserve(q, 60, { account: addr(1), policyId: hash(2) });
  reserve(q, 61, { account: addr(2), policyId: hash(3) });
  assert.throws(() => reserve(q, 62, { account: addr(3), policyId: hash(4) }), /GAS9_SPONSOR_CONCURRENCY_EXCEEDED/);
});

test('GAS-9.3 reaps expired reservations without refunding window usage', () => {
  const q = controller({ maxConcurrentPerAccount: 1, maxConcurrentSponsor: 1, maxTrackedAuthorizations: 10 });
  reserve(q, 70, { nowMs: 100, expiresAtMs: 200 });
  assert.equal(q.snapshot({ account: addr(1), policyId: hash(2), nowMs: 199 }).accountConcurrent, 1);
  const after = q.snapshot({ account: addr(1), policyId: hash(2), nowMs: 200 });
  assert.equal(after.accountConcurrent, 0);
  assert.equal(after.sponsorConcurrent, 0);
  assert.equal(after.accountOperations, 1);
  assert.equal(after.accountSponsoredWei, 100n);
  reserve(q, 71, { nowMs: 200, expiresAtMs: 300 });
});

test('GAS-9.3 rejects invalid or overlong reservation expiry', () => {
  const q = controller({ maxReservationAgeMs: 500 });
  assert.throws(() => reserve(q, 80, { nowMs: 100, expiresAtMs: 100 }), /GAS9_RESERVATION_EXPIRY_INVALID/);
  assert.throws(() => reserve(q, 81, { nowMs: 100, expiresAtMs: 601 }), /GAS9_RESERVATION_EXPIRY_INVALID/);
});
