import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GasSponsorshipError420,
  prepareWalletGasSponsorship420,
  validateWalletGasQuote420,
  walletGasSponsorshipReview420,
} from '../core/gas-sponsorship.js';

const now = new Date('2026-09-14T23:30:00.000Z');
const addr = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const hash = (n) => `0x${n.toString(16).padStart(64, '0')}`;

function unsignedOperation(overrides = {}) {
  return {
    sender: addr(1), nonce: 7n, initCode: '0x', callData: '0x1234', accountGasLimits: hash(2),
    preVerificationGas: 21000n, gasFees: hash(3), paymasterAndData: '0x', signature: '0x', ...overrides,
  };
}

function quote(overrides = {}) {
  return {
    quoteId: hash(10), chainId: '420', entryPoint: addr(2), paymaster: addr(3), account: addr(1),
    sponsorshipDigest: hash(20), policyId: hash(11), authorizationId: hash(12),
    maxSponsoredCostWei: '1000000000000000', validAfter: '2026-09-14T23:29:00.000Z',
    validUntil: '2026-09-14T23:31:00.000Z', paymasterAndData: '0x123456',
    authority: 'funding-offer-only', executionAuthorization: false, walletAuthorization: false,
    targetProtocolAuthorization: false, canonicalProtocolAuthority: false, ...overrides,
  };
}

test('GAS-11.3 rejects every quote-side authority escalation flag at the Wallet boundary', () => {
  for (const override of [
    { executionAuthorization: true },
    { walletAuthorization: true },
    { targetProtocolAuthorization: true },
    { canonicalProtocolAuthority: true },
  ]) {
    assert.throws(
      () => validateWalletGasQuote420(quote(override), { entryPoint: addr(2), account: addr(1), now }),
      GasSponsorshipError420,
    );
  }
});

test('GAS-11.3 rejects non-boolean authority smuggling instead of coercing it', () => {
  for (const field of ['executionAuthorization', 'walletAuthorization', 'targetProtocolAuthorization', 'canonicalProtocolAuthority']) {
    assert.throws(
      () => validateWalletGasQuote420(quote({ [field]: 'false' }), { entryPoint: addr(2), account: addr(1), now }),
      GasSponsorshipError420,
    );
  }
});

test('GAS-11.3 Wallet sponsorship request explicitly disclaims all execution authority domains', async () => {
  const prepared = await prepareWalletGasSponsorship420({
    userOperation: unsignedOperation(),
    entryPoint: addr(2),
    discoverQuote: async (request) => {
      assert.equal(request.authority, 'funding-request-only');
      assert.equal(request.executionAuthorization, false);
      assert.equal(request.walletAuthorization, false);
      assert.equal(request.targetProtocolAuthorization, false);
      assert.equal(request.canonicalProtocolAuthority, false);
      return quote();
    },
    hashSponsorship: async () => hash(20),
    hashUserOperation: async () => hash(21),
    now,
  });
  assert.equal(prepared.executionAuthorization, false);
  assert.equal(prepared.walletAuthorization, false);
  assert.equal(prepared.targetProtocolAuthorization, false);
  assert.equal(prepared.canonicalProtocolAuthority, false);
});

test('GAS-11.3 review cannot be used as a second authority-smuggling surface', () => {
  const base = { sponsored: true, fundingMode: 'paymaster', executionAuthorization: false, quote: quote() };
  for (const override of [
    { walletAuthorization: true },
    { targetProtocolAuthorization: true },
    { canonicalProtocolAuthority: true },
  ]) {
    assert.throws(() => walletGasSponsorshipReview420({ ...base, ...override }), GasSponsorshipError420);
  }
  for (const override of [
    { walletAuthorization: true },
    { targetProtocolAuthorization: true },
    { canonicalProtocolAuthority: true },
  ]) {
    assert.throws(
      () => walletGasSponsorshipReview420({ ...base, quote: quote(override) }),
      GasSponsorshipError420,
    );
  }
});
