import assert from 'node:assert/strict';
import test from 'node:test';
import { GasQuotaController420 } from '../src/quota-controller.mjs';
import { createGasQuote420, releaseGasQuoteQuota420 } from '../src/quote-service.mjs';

const now = new Date('2026-09-15T18:50:00.000Z');
const addr = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const hash = (n) => `0x${n.toString(16).padStart(64, '0')}`;

function credential() {
  return {
    applicationId: 'wallet420',
    audience: '420gas',
    scopes: ['gas:quote'],
    expiresAt: '2026-09-15T19:50:00.000Z',
  };
}

function request(overrides = {}) {
  return {
    schemaVersion: '1.2.0',
    chainId: '420',
    entryPoint: addr(1),
    paymaster: addr(2),
    account: addr(3),
    sponsorshipDigest: hash(4),
    policyId: hash(5),
    authorizationId: hash(6),
    maxSponsoredCostWei: '100',
    gasLimit: '100',
    maxFeePerGasWei: '1',
    maxPriorityFeePerGasWei: '0',
    validAfter: '2026-09-15T18:49:59.000Z',
    validUntil: '2026-09-15T18:51:00.000Z',
    ...overrides,
  };
}

function controller(overrides = {}) {
  return new GasQuotaController420({
    windowMs: 60_000,
    maxSponsoredCostPerOperationWei: '1000',
    maxAccountWindowWei: '1000',
    maxPolicyWindowWei: '2000',
    maxSponsorWindowWei: '10000',
    maxAccountOperationsPerWindow: 10,
    maxPolicyOperationsPerWindow: 20,
    maxSponsorOperationsPerWindow: 100,
    maxConcurrentPerAccount: 2,
    maxConcurrentSponsor: 20,
    maxTrackedAuthorizations: 20,
    maxReservationAgeMs: 300_000,
    ...overrides,
  });
}

test('GAS-9.2 reserves quota before signing and exposes the bounded reservation', () => {
  const quota = controller();
  let snapshotDuringSign;
  const quote = createGasQuote420({
    request: request(),
    credential: credential(),
    now,
    quotaController: quota,
    sign: () => {
      snapshotDuringSign = quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: now.getTime() });
      return 'signature';
    },
  });

  assert.equal(snapshotDuringSign.accountConcurrent, 1);
  assert.equal(snapshotDuringSign.accountSponsoredWei, 100n);
  assert.equal(quote.quotaReservation.authorizationId, hash(6));
  assert.equal(quote.quotaReservation.reservedWei, 100n);
  assert.equal(quote.quotaReservation.reservationId, 1);
});

test('GAS-9.2 refuses a second outstanding quote when account concurrency is exhausted', () => {
  const quota = controller({ maxConcurrentPerAccount: 1 });
  createGasQuote420({ request: request(), credential: credential(), now, quotaController: quota, sign: () => 'sig-1' });

  assert.throws(() => createGasQuote420({
    request: request({ authorizationId: hash(7), sponsorshipDigest: hash(8) }),
    credential: credential(),
    now,
    quotaController: quota,
    sign: () => 'sig-2',
  }), /GAS9_ACCOUNT_CONCURRENCY_EXCEEDED/);
});

test('GAS-9.2 rolls quota reservation and window accounting back when signing fails', () => {
  const quota = controller({ maxConcurrentPerAccount: 1 });
  assert.throws(() => createGasQuote420({
    request: request(),
    credential: credential(),
    now,
    quotaController: quota,
    sign: () => { throw new Error('SIGNER_DOWN'); },
  }), /GAS11_SIGNER_DEPENDENCY_FAILED/);

  const snapshot = quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: now.getTime() });
  assert.equal(snapshot.accountConcurrent, 0);
  assert.equal(snapshot.trackedAuthorizations, 0);
  assert.equal(snapshot.accountOperations, 0);
  assert.equal(snapshot.policyOperations, 0);
  assert.equal(snapshot.sponsorOperations, 0);
  assert.equal(snapshot.accountSponsoredWei, 0n);

  assert.doesNotThrow(() => createGasQuote420({
    request: request(),
    credential: credential(),
    now,
    quotaController: quota,
    sign: () => 'signature',
  }));
});

test('GAS-9.2 explicit release frees outstanding capacity without refunding window spend', () => {
  const quota = controller({ maxConcurrentPerAccount: 1 });
  const first = createGasQuote420({ request: request(), credential: credential(), now, quotaController: quota, sign: () => 'sig-1' });

  assert.equal(releaseGasQuoteQuota420({ quotaController: quota, quotaReservation: first.quotaReservation }), true);
  const snapshot = quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: now.getTime() });
  assert.equal(snapshot.accountConcurrent, 0);
  assert.equal(snapshot.accountOperations, 1);
  assert.equal(snapshot.accountSponsoredWei, 100n);

  assert.doesNotThrow(() => createGasQuote420({
    request: request({ authorizationId: hash(7), sponsorshipDigest: hash(8) }),
    credential: credential(),
    now,
    quotaController: quota,
    sign: () => 'sig-2',
  }));
});

test('GAS-9.2 preserves backwards-compatible quote issuance without a quota controller', () => {
  const quote = createGasQuote420({ request: request(), credential: credential(), now, sign: () => 'signature' });
  assert.equal(quote.quotaReservation, null);
  assert.equal(quote.executionAuthorization, false);
  assert.equal(quote.canonicalProtocolAuthority, false);
});

test('GAS-9.3 binds outstanding reservation expiry to the signed quote validity window', () => {
  const quota = controller({ maxConcurrentPerAccount: 1 });
  const quote = createGasQuote420({ request: request(), credential: credential(), now, quotaController: quota, sign: () => 'signature' });
  assert.equal(quote.quotaReservation.expiresAtMs, Date.parse(quote.validUntil));

  const beforeExpiry = quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: Date.parse(quote.validUntil) - 1 });
  assert.equal(beforeExpiry.accountConcurrent, 1);
  const atExpiry = quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: Date.parse(quote.validUntil) });
  assert.equal(atExpiry.accountConcurrent, 0);
  assert.equal(atExpiry.sponsorConcurrent, 0);
});

test('GAS-9.3 sponsor concurrency is recovered automatically from abandoned expired quotes', () => {
  const quota = controller({ maxConcurrentPerAccount: 10, maxConcurrentSponsor: 1 });
  const first = createGasQuote420({ request: request(), credential: credential(), now, quotaController: quota, sign: () => 'sig-1' });
  assert.equal(first.quotaReservation.expiresAtMs, Date.parse(first.validUntil));

  const later = new Date('2026-09-15T18:51:00.000Z');
  assert.doesNotThrow(() => createGasQuote420({
    request: request({
      authorizationId: hash(7),
      sponsorshipDigest: hash(8),
      validAfter: '2026-09-15T18:50:59.000Z',
      validUntil: '2026-09-15T18:52:00.000Z',
    }),
    credential: credential(),
    now: later,
    quotaController: quota,
    sign: () => 'sig-2',
  }));
});

test('GAS-9.5 re-entrant duplicate issuance cannot pass the active authorization reservation', () => {
  const quota = controller({ maxConcurrentPerAccount: 10, maxConcurrentSponsor: 10 });
  let nestedError;
  const outer = createGasQuote420({
    request: request(),
    credential: credential(),
    now,
    quotaController: quota,
    sign: () => {
      try {
        createGasQuote420({ request: request(), credential: credential(), now, quotaController: quota, sign: () => 'nested' });
      } catch (error) {
        nestedError = error;
      }
      return 'outer';
    },
  });
  assert.match(String(nestedError?.message), /GAS9_DUPLICATE_AUTHORIZATION/);
  assert.equal(outer.quotaReservation.authorizationId, hash(6));
  assert.equal(quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: now.getTime() }).accountConcurrent, 1);
});

test('GAS-9.5 re-entrant different authorization cannot oversubscribe account concurrency', () => {
  const quota = controller({ maxConcurrentPerAccount: 1, maxConcurrentSponsor: 10 });
  let nestedError;
  createGasQuote420({
    request: request(),
    credential: credential(),
    now,
    quotaController: quota,
    sign: () => {
      try {
        createGasQuote420({
          request: request({ authorizationId: hash(7), sponsorshipDigest: hash(8) }),
          credential: credential(),
          now,
          quotaController: quota,
          sign: () => 'nested',
        });
      } catch (error) {
        nestedError = error;
      }
      return 'outer';
    },
  });
  assert.match(String(nestedError?.message), /GAS9_ACCOUNT_CONCURRENCY_EXCEEDED/);
  const snapshot = quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: now.getTime() });
  assert.equal(snapshot.accountConcurrent, 1);
  assert.equal(snapshot.accountOperations, 1);
  assert.equal(snapshot.accountSponsoredWei, 100n);
});

test('GAS-9.5 stale release from an expired quote cannot release its replacement reservation', () => {
  const quota = controller({ maxConcurrentPerAccount: 10, maxConcurrentSponsor: 10, maxAccountOperationsPerWindow: 20 });
  const first = createGasQuote420({ request: request({ validUntil: '2026-09-15T18:50:10.000Z' }), credential: credential(), now, quotaController: quota, sign: () => 'first' });
  const later = new Date('2026-09-15T18:50:10.000Z');
  const second = createGasQuote420({
    request: request({ validAfter: '2026-09-15T18:50:09.000Z', validUntil: '2026-09-15T18:51:00.000Z' }),
    credential: credential(),
    now: later,
    quotaController: quota,
    sign: () => 'second',
  });
  assert.notEqual(first.quotaReservation.reservationId, second.quotaReservation.reservationId);
  assert.equal(releaseGasQuoteQuota420({ quotaController: quota, quotaReservation: first.quotaReservation }), false);
  assert.equal(quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: later.getTime() }).accountConcurrent, 1);
  assert.equal(releaseGasQuoteQuota420({ quotaController: quota, quotaReservation: second.quotaReservation }), true);
});
