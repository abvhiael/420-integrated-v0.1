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
    schemaVersion: '1.1.0',
    chainId: '420',
    entryPoint: addr(1),
    paymaster: addr(2),
    account: addr(3),
    sponsorshipDigest: hash(4),
    policyId: hash(5),
    authorizationId: hash(6),
    maxSponsoredCostWei: '100',
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
    maxAccountOperationsPerWindow: 10,
    maxPolicyOperationsPerWindow: 20,
    maxConcurrentPerAccount: 2,
    maxTrackedAuthorizations: 20,
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

test('GAS-9.2 rolls quota reservation back when signing fails', () => {
  const quota = controller({ maxConcurrentPerAccount: 1 });
  assert.throws(() => createGasQuote420({
    request: request(),
    credential: credential(),
    now,
    quotaController: quota,
    sign: () => { throw new Error('SIGNER_DOWN'); },
  }), /SIGNER_DOWN/);

  const snapshot = quota.snapshot({ account: addr(3), policyId: hash(5), nowMs: now.getTime() });
  assert.equal(snapshot.accountConcurrent, 0);
  assert.equal(snapshot.trackedAuthorizations, 0);

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
  createGasQuote420({ request: request(), credential: credential(), now, quotaController: quota, sign: () => 'sig-1' });

  assert.equal(releaseGasQuoteQuota420({ quotaController: quota, authorizationId: hash(6) }), true);
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
