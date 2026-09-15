import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GasQuoteError420,
  createGasQuote420,
  createGasQuoteReadView420,
  validateGasQuoteCredential420,
  validateGasQuoteRequest420
} from '../src/quote-service.mjs';

const now = new Date('2026-09-14T22:00:00.000Z');
const addr = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const hash = (n) => `0x${n.toString(16).padStart(64, '0')}`;

function credential(overrides = {}) {
  return {
    applicationId: 'wallet420',
    audience: '420gas',
    scopes: ['gas:quote', 'gas:read'],
    expiresAt: '2026-09-14T23:00:00.000Z',
    ...overrides
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
    maxSponsoredCostWei: '1000000000000000',
    gasLimit: '500000',
    maxFeePerGasWei: '1000000000',
    maxPriorityFeePerGasWei: '100000000',
    validAfter: '2026-09-14T21:59:50.000Z',
    validUntil: '2026-09-14T22:02:00.000Z',
    ...overrides
  };
}

function issue(overrides = {}) {
  return createGasQuote420({
    request: request(overrides.request),
    credential: credential(overrides.credential),
    now,
    economicLimits: overrides.economicLimits,
    sign: ({ sponsorshipDigest }) => `sig:${sponsorshipDigest}`
  });
}

test('issues deterministic sponsorship-bound funding quote without execution authority', () => {
  const quote = issue();
  assert.equal(quote.chainId, '420');
  assert.equal(quote.account, addr(3));
  assert.equal(quote.sponsorshipDigest, hash(4));
  assert.equal(quote.policyId, hash(5));
  assert.equal(quote.authorizationId, hash(6));
  assert.equal(quote.gasLimit, '500000');
  assert.equal(quote.maxFeePerGasWei, '1000000000');
  assert.equal(quote.maxPriorityFeePerGasWei, '100000000');
  assert.equal(quote.fundingMode, 'paymaster');
  assert.equal(quote.authority, 'funding-offer-only');
  assert.equal(quote.executionAuthorization, false);
  assert.equal(quote.walletAuthorization, false);
  assert.equal(quote.targetProtocolAuthorization, false);
  assert.equal(quote.canonicalProtocolAuthority, false);
  assert.equal(quote.sponsorSecretExposed, false);
  assert.match(quote.quoteId, /^0x[0-9a-f]{64}$/);
  assert.equal(quote.quoteId, quote.quoteCommitment);
  assert.equal(quote.signature, `sig:${quote.sponsorshipDigest}`);
});

test('same sponsorship-bound request produces same commitment at the same issuance time and gas economics are committed', () => {
  assert.equal(issue().quoteCommitment, issue().quoteCommitment);
  assert.notEqual(issue({ request: { sponsorshipDigest: hash(7) } }).quoteCommitment, issue().quoteCommitment);
  assert.notEqual(issue({ request: { gasLimit: '500001' } }).quoteCommitment, issue().quoteCommitment);
  assert.notEqual(issue({ request: { maxFeePerGasWei: '1000000001' } }).quoteCommitment, issue().quoteCommitment);
});

test('legacy final userOpHash field is rejected so funding and execution signatures cannot be conflated', () => {
  const legacy = { ...request(), userOpHash: hash(7) };
  delete legacy.sponsorshipDigest;
  assert.throws(() => validateGasQuoteRequest420(legacy), /unsupported field|sponsorshipDigest/);
});

test('fails closed on wrong audience, missing quote scope and expired credential', () => {
  assert.throws(() => issue({ credential: { audience: 'developerhub' } }), GasQuoteError420);
  assert.throws(() => issue({ credential: { scopes: ['gas:read'] } }), GasQuoteError420);
  assert.throws(() => issue({ credential: { expiresAt: '2026-09-14T21:59:59.000Z' } }), GasQuoteError420);
});

test('enforces short lived quote window', () => {
  assert.throws(() => issue({ request: { validAfter: '2026-09-14T22:00:01.000Z' } }), /not yet valid/);
  assert.throws(() => issue({ request: { validUntil: '2026-09-14T21:59:59.000Z' } }), /validUntil must be after validAfter|expired/);
  assert.throws(() => issue({ request: { validUntil: '2026-09-14T22:06:00.000Z' } }), /maximum TTL/);
});

test('GAS-9.4 enforces sponsor gas and fee ceilings before signing', () => {
  let signed = false;
  const limits = { maxGasLimit: 500000n, maxFeePerGasWei: 1000000000n, maxPriorityFeePerGasWei: 100000000n };
  assert.throws(() => createGasQuote420({ request: request({ gasLimit: '500001' }), credential: credential(), now, economicLimits: limits, sign: () => { signed = true; return 'sig'; } }), /gasLimit exceeds sponsor ceiling/);
  assert.equal(signed, false);
  assert.throws(() => issue({ request: { maxFeePerGasWei: '1000000001' }, economicLimits: limits }), /maxFeePerGasWei exceeds sponsor ceiling/);
  assert.throws(() => issue({ request: { maxPriorityFeePerGasWei: '100000001' }, economicLimits: limits }), /maxPriorityFeePerGasWei exceeds sponsor ceiling/);
});

test('GAS-9.4 rejects internally inconsistent fee envelopes', () => {
  assert.throws(() => validateGasQuoteRequest420(request({ maxFeePerGasWei: '100', maxPriorityFeePerGasWei: '101' })), /exceeds maxFeePerGasWei/);
  assert.throws(() => validateGasQuoteRequest420(request({ gasLimit: '0' })), /greater than zero/);
});

test('strict request binding rejects malformed identifiers and unsupported fields', () => {
  assert.throws(() => validateGasQuoteRequest420(request({ chainId: '0' })), GasQuoteError420);
  assert.throws(() => validateGasQuoteRequest420(request({ account: '0x1234' })), GasQuoteError420);
  assert.throws(() => validateGasQuoteRequest420(request({ sponsorshipDigest: '0x1234' })), GasQuoteError420);
  assert.throws(() => validateGasQuoteRequest420({ ...request(), extra: true }), /unsupported field/);
});

test('quote read view remains authority-minimized and requires read scope', () => {
  const quote = issue();
  const view = createGasQuoteReadView420(quote, { credential: credential(), now });
  assert.deepEqual(Object.keys(view).sort(), [
    'account', 'authorizationId', 'authority', 'canonicalProtocolAuthority', 'chainId', 'entryPoint',
    'executionAuthorization', 'gasLimit', 'maxFeePerGasWei', 'maxPriorityFeePerGasWei', 'maxSponsoredCostWei',
    'paymaster', 'policyId', 'quoteId', 'sponsorshipDigest', 'validAfter', 'validUntil'
  ].sort());
  assert.equal(view.executionAuthorization, false);
  assert.equal(view.canonicalProtocolAuthority, false);
  assert.throws(() => createGasQuoteReadView420(quote, { credential: credential({ scopes: ['gas:quote'] }), now }), /gas:read/);
});

test('credential and request validators normalize canonical fields', () => {
  const c = validateGasQuoteCredential420(credential(), { now });
  const r = validateGasQuoteRequest420(request({ entryPoint: addr(10).toUpperCase().replace('0X', '0x') }));
  assert.equal(c.applicationId, 'wallet420');
  assert.equal(r.entryPoint, addr(10));
});
