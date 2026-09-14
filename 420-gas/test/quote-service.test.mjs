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
    schemaVersion: '1.0.0',
    chainId: '420',
    entryPoint: addr(1),
    paymaster: addr(2),
    account: addr(3),
    userOpHash: hash(4),
    policyId: hash(5),
    authorizationId: hash(6),
    maxSponsoredCostWei: '1000000000000000',
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
    sign: ({ quoteCommitment }) => `sig:${quoteCommitment}`
  });
}

test('issues deterministic operation-bound funding quote without execution authority', () => {
  const quote = issue();
  assert.equal(quote.chainId, '420');
  assert.equal(quote.account, addr(3));
  assert.equal(quote.userOpHash, hash(4));
  assert.equal(quote.policyId, hash(5));
  assert.equal(quote.authorizationId, hash(6));
  assert.equal(quote.fundingMode, 'paymaster');
  assert.equal(quote.authority, 'funding-offer-only');
  assert.equal(quote.executionAuthorization, false);
  assert.equal(quote.walletAuthorization, false);
  assert.equal(quote.targetProtocolAuthorization, false);
  assert.equal(quote.canonicalProtocolAuthority, false);
  assert.equal(quote.sponsorSecretExposed, false);
  assert.match(quote.quoteId, /^0x[0-9a-f]{64}$/);
  assert.equal(quote.quoteId, quote.quoteCommitment);
  assert.equal(quote.signature, `sig:${quote.quoteCommitment}`);
});

test('same operation-bound request produces same commitment at the same issuance time', () => {
  assert.equal(issue().quoteCommitment, issue().quoteCommitment);
  assert.notEqual(issue({ request: { userOpHash: hash(7) } }).quoteCommitment, issue().quoteCommitment);
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

test('strict request binding rejects malformed identifiers and unsupported fields', () => {
  assert.throws(() => validateGasQuoteRequest420(request({ chainId: '0' })), GasQuoteError420);
  assert.throws(() => validateGasQuoteRequest420(request({ account: '0x1234' })), GasQuoteError420);
  assert.throws(() => validateGasQuoteRequest420(request({ userOpHash: '0x1234' })), GasQuoteError420);
  assert.throws(() => validateGasQuoteRequest420({ ...request(), extra: true }), /unsupported field/);
});

test('quote read view remains authority-minimized and requires read scope', () => {
  const quote = issue();
  const view = createGasQuoteReadView420(quote, { credential: credential(), now });
  assert.deepEqual(Object.keys(view).sort(), [
    'account', 'authorizationId', 'authority', 'canonicalProtocolAuthority', 'chainId', 'entryPoint',
    'executionAuthorization', 'maxSponsoredCostWei', 'paymaster', 'policyId', 'quoteId', 'userOpHash',
    'validAfter', 'validUntil'
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
