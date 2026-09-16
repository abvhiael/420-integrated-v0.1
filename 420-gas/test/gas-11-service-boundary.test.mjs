import assert from 'node:assert/strict';
import test from 'node:test';
import { GasQuotaController420 } from '../src/quota-controller.mjs';
import {
  GasQuoteError420,
  createGasQuote420,
  createGasQuoteReadView420,
  releaseGasQuoteQuota420,
  validateGasQuoteCredential420,
} from '../src/quote-service.mjs';

const now = new Date('2026-09-16T05:00:00.000Z');
const addr = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const hash = (n) => `0x${n.toString(16).padStart(64, '0')}`;

function credential(overrides = {}) {
  return {
    applicationId: 'wallet420',
    audience: '420gas',
    scopes: ['gas:quote', 'gas:read'],
    expiresAt: '2026-09-16T06:00:00.000Z',
    ...overrides,
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
    validAfter: '2026-09-16T04:59:59.000Z',
    validUntil: '2026-09-16T05:01:00.000Z',
    ...overrides,
  };
}

function quota() {
  return new GasQuotaController420({
    maxSponsoredCostPerOperationWei: '1000',
    maxAccountWindowWei: '1000',
    maxPolicyWindowWei: '1000',
    maxSponsorWindowWei: '1000',
    maxAccountOperationsPerWindow: 10,
    maxPolicyOperationsPerWindow: 10,
    maxSponsorOperationsPerWindow: 10,
    maxConcurrentPerAccount: 2,
    maxConcurrentSponsor: 10,
    maxTrackedAuthorizations: 10,
  });
}

test('GAS-11.5 rejects unsupported credential scopes and credential field smuggling', () => {
  assert.throws(
    () => validateGasQuoteCredential420(credential({ scopes: ['gas:quote', 'gas:admin'] }), { now }),
    /unsupported scope/,
  );
  assert.throws(
    () => validateGasQuoteCredential420({ ...credential(), operatorSecret: 'dont-leak-me' }, { now }),
    /unsupported field/,
  );
});

test('GAS-11.5 malformed or invalid service clocks fail as controlled quote errors', () => {
  for (const badNow of [new Date('invalid'), '2026-09-16T05:00:00Z', null, {}]) {
    assert.throws(
      () => validateGasQuoteCredential420(credential(), { now: badNow }),
      (error) => error instanceof GasQuoteError420 && /service clock is invalid/.test(error.message),
    );
  }
});

test('GAS-11.5 signer receives only immutable sponsorship material, never caller credential data', () => {
  let signerInput;
  const quote = createGasQuote420({
    request: request(),
    credential: credential(),
    now,
    sign: (input) => {
      signerInput = input;
      assert.equal(Object.isFrozen(input), true);
      assert.equal(Object.isFrozen(input.quote), true);
      assert.deepEqual(Object.keys(input).sort(), ['quote', 'quoteCommitment', 'sponsorshipDigest']);
      assert.equal('credential' in input, false);
      assert.equal('applicationId' in input, false);
      assert.equal('operatorSecret' in input, false);
      assert.throws(() => { input.quote.chainId = '421'; }, TypeError);
      return 'signature';
    },
  });
  assert.equal(signerInput.sponsorshipDigest, quote.sponsorshipDigest);
  assert.equal(quote.issuedToApplicationId, 'wallet420');
});

test('GAS-11.5 signer exceptions are sanitized and cannot leak secret-bearing adapter details', () => {
  const secret = 'kms://prod-hsm/key-420?token=super-secret';
  assert.throws(
    () => createGasQuote420({
      request: request(),
      credential: credential(),
      now,
      sign: () => { throw new Error(`HSM transport failed ${secret}`); },
    }),
    (error) => error instanceof GasQuoteError420
      && error.message === 'GAS11_SIGNER_DEPENDENCY_FAILED'
      && !String(error).includes(secret),
  );
});

test('GAS-11.5 signer failure rolls quota state back while exposing only the stable failure code', () => {
  const controller = quota();
  assert.throws(
    () => createGasQuote420({
      request: request(),
      credential: credential(),
      now,
      quotaController: controller,
      sign: () => { throw new Error('key alias prod/paymaster/420'); },
    }),
    /GAS11_SIGNER_DEPENDENCY_FAILED/,
  );
  const snapshot = controller.snapshot({ account: addr(3), policyId: hash(5), nowMs: now.getTime() });
  assert.equal(snapshot.accountConcurrent, 0);
  assert.equal(snapshot.trackedAuthorizations, 0);
  assert.equal(snapshot.accountOperations, 0);
});

test('GAS-11.5 invalid signer output fails closed and also rolls the reservation back', () => {
  const controller = quota();
  assert.throws(
    () => createGasQuote420({
      request: request(),
      credential: credential(),
      now,
      quotaController: controller,
      sign: () => '',
    }),
    /quote signer returned invalid signature/,
  );
  assert.equal(controller.snapshot({ account: addr(3), policyId: hash(5), nowMs: now.getTime() }).accountConcurrent, 0);
});

test('GAS-11.5 generic quota adapter errors are sanitized while canonical quota policy errors remain intact', () => {
  const broken = {
    reserve() { throw new Error('postgres://user:secret@quota.internal/db'); },
    release() { throw new Error('internal release secret'); },
    rollback() { throw new Error('internal rollback secret'); },
  };
  assert.throws(
    () => createGasQuote420({ request: request(), credential: credential(), now, quotaController: broken, sign: () => 'sig' }),
    (error) => error instanceof GasQuoteError420 && error.message === 'GAS11_QUOTA_DEPENDENCY_FAILED',
  );

  const canonical = quota();
  createGasQuote420({ request: request(), credential: credential(), now, quotaController: canonical, sign: () => 'sig' });
  assert.throws(
    () => createGasQuote420({ request: request(), credential: credential(), now, quotaController: canonical, sign: () => 'sig' }),
    /GAS9_DUPLICATE_AUTHORIZATION/,
  );
});

test('GAS-11.5 rollback dependency failure is stable and redacted', () => {
  const controller = {
    reserve(input) {
      return {
        ...input,
        reservationId: 1,
        reservedWei: 100n,
        windowId: 1,
      };
    },
    release() { return true; },
    rollback() { throw new Error('redis://secret@rollback.internal'); },
  };
  assert.throws(
    () => createGasQuote420({
      request: request(),
      credential: credential(),
      now,
      quotaController: controller,
      sign: () => { throw new Error('kms secret'); },
    }),
    (error) => error instanceof GasQuoteError420 && error.message === 'GAS11_QUOTA_ROLLBACK_FAILED',
  );
});

test('GAS-11.5 read views redact signature, application identity and internal reservation handles', () => {
  const controller = quota();
  const quote = createGasQuote420({
    request: request(),
    credential: credential(),
    now,
    quotaController: controller,
    sign: () => 'super-sensitive-signature-material',
  });
  const view = createGasQuoteReadView420(quote, { credential: credential({ scopes: ['gas:read'] }), now });
  for (const forbidden of ['signature', 'issuedToApplicationId', 'quotaReservation', 'sponsorSecretExposed']) {
    assert.equal(forbidden in view, false);
  }
  assert.equal(view.executionAuthorization, false);
  assert.equal(view.canonicalProtocolAuthority, false);
});

test('GAS-11.5 missing signer fails before quota state allocation', () => {
  const controller = quota();
  assert.throws(
    () => createGasQuote420({ request: request(), credential: credential(), now, quotaController: controller }),
    /quote signer is required/,
  );
  assert.equal(controller.snapshot({ account: addr(3), policyId: hash(5), nowMs: now.getTime() }).trackedAuthorizations, 0);
});

test('GAS-11.5 generic release dependency errors are sanitized', () => {
  const broken = {
    reserve() { return null; },
    rollback() { return true; },
    release() { throw new Error('release backend secret'); },
  };
  assert.throws(
    () => releaseGasQuoteQuota420({ quotaController: broken, quotaReservation: { authorizationId: hash(6), reservationId: 1 } }),
    /GAS11_QUOTA_DEPENDENCY_FAILED/,
  );
});
