import assert from 'node:assert/strict';
import test from 'node:test';
import { GasQuotaController420, GasQuotaError420 } from '../src/quota-controller.mjs';

const addr = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const hash = (n) => `0x${n.toString(16).padStart(64, '0')}`;

function controller(overrides = {}) {
  return new GasQuotaController420({
    windowMs: 1_000,
    maxSponsoredCostPerOperationWei: 100n,
    maxAccountWindowWei: 100_000n,
    maxPolicyWindowWei: 100_000n,
    maxSponsorWindowWei: 100_000n,
    maxAccountOperationsPerWindow: 1_000,
    maxPolicyOperationsPerWindow: 1_000,
    maxSponsorOperationsPerWindow: 1_000,
    maxConcurrentPerAccount: 1_000,
    maxConcurrentSponsor: 1_000,
    maxTrackedAuthorizations: 1_000,
    maxTrackedWindows: 100,
    maxReservationAgeMs: 5_000,
    ...overrides,
  });
}

function reserve(q, n, overrides = {}) {
  return q.reserve({
    account: addr(n),
    policyId: hash(n + 1_000),
    authorizationId: hash(n + 2_000),
    maxSponsoredCostWei: 100n,
    nowMs: 100,
    expiresAtMs: 900,
    ...overrides,
  });
}

function handle(reservation) {
  return { authorizationId: reservation.authorizationId, reservationId: reservation.reservationId };
}

test('GAS-9.6 read-only snapshots cannot allocate attacker-controlled window keys', () => {
  const q = controller({ maxTrackedWindows: 3 });
  for (let i = 1; i <= 500; i += 1) {
    const snapshot = q.snapshot({ account: addr(i), policyId: hash(i), nowMs: 100 });
    assert.equal(snapshot.accountOperations, 0);
    assert.equal(snapshot.policyOperations, 0);
    assert.equal(snapshot.trackedWindows, 0);
  }
  assert.equal(q.windows.size, 0);
});

test('GAS-9.6 hard-caps unique current-window state and recovers capacity after rollover', () => {
  const q = controller({ maxTrackedWindows: 3 });
  const first = reserve(q, 1);
  assert.equal(q.windows.size, 3);
  assert.equal(q.release(handle(first)), true);

  assert.throws(() => reserve(q, 2), /GAS9_WINDOW_STATE_CAPACITY_EXCEEDED/);
  assert.equal(q.windows.size, 3);

  assert.doesNotThrow(() => reserve(q, 2, { nowMs: 1_100, expiresAtMs: 1_900 }));
  assert.equal(q.windows.size, 3);
});

test('GAS-9.6 rejected sponsor-quota floods do not allocate new account or policy state', () => {
  const q = controller({ maxSponsorOperationsPerWindow: 1, maxTrackedWindows: 100 });
  const first = reserve(q, 1);
  assert.equal(q.release(handle(first)), true);
  assert.equal(q.windows.size, 3);

  for (let i = 2; i <= 100; i += 1) {
    assert.throws(() => reserve(q, i), /GAS9_SPONSOR_OPERATION_QUOTA_EXCEEDED/);
  }
  assert.equal(q.windows.size, 3);
});

test('GAS-9.6 rollover prunes stale counter keys without dropping active reservation concurrency', () => {
  const q = controller({ maxTrackedWindows: 3 });
  const reservation = reserve(q, 1, { expiresAtMs: 1_500 });
  assert.equal(q.windows.size, 3);

  const nextWindow = q.snapshot({ account: addr(1), policyId: hash(1_001), nowMs: 1_100 });
  assert.equal(nextWindow.trackedWindows, 0);
  assert.equal(nextWindow.accountOperations, 0);
  assert.equal(nextWindow.policyOperations, 0);
  assert.equal(nextWindow.sponsorOperations, 0);
  assert.equal(nextWindow.accountConcurrent, 1);
  assert.equal(nextWindow.sponsorConcurrent, 1);

  assert.equal(q.rollback(handle(reservation)), true);
  assert.equal(q.snapshot({ account: addr(1), policyId: hash(1_001), nowMs: 1_100 }).sponsorConcurrent, 0);
});

test('GAS-9.6 validates the tracked-window bound', () => {
  assert.throws(() => controller({ maxTrackedWindows: 0 }), GasQuotaError420);
  assert.throws(() => controller({ maxTrackedWindows: 2_000_002 }), /GAS9_TRACKED_WINDOWS_LIMIT_INVALID/);
});
