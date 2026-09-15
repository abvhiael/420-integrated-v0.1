import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GasSponsorshipError420,
  prepareWalletGasSponsorship420,
  validateWalletGasQuote420,
  walletGasSponsorshipFailure420,
  walletGasSponsorshipReview420,
} from '../core/gas-sponsorship.js';

const now = new Date('2026-09-14T23:30:00.000Z');
const addr = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const hash = (n) => `0x${n.toString(16).padStart(64, '0')}`;

function unsignedOperation(overrides = {}) {
  return {
    sender: addr(1),
    nonce: 7n,
    initCode: '0x',
    callData: '0x1234',
    accountGasLimits: hash(2),
    preVerificationGas: 21000n,
    gasFees: hash(3),
    paymasterAndData: '0x',
    signature: '0x',
    ...overrides,
  };
}

function quote(overrides = {}) {
  return {
    quoteId: hash(10),
    chainId: '420',
    entryPoint: addr(2),
    paymaster: addr(3),
    account: addr(1),
    userOpHash: hash(20),
    policyId: hash(11),
    authorizationId: hash(12),
    maxSponsoredCostWei: '1000000000000000',
    validAfter: '2026-09-14T23:29:00.000Z',
    validUntil: '2026-09-14T23:31:00.000Z',
    paymasterAndData: '0x123456',
    authority: 'funding-offer-only',
    executionAuthorization: false,
    ...overrides,
  };
}

test('validates Wallet sponsorship quote without granting execution authority', () => {
  const validated = validateWalletGasQuote420(quote(), { entryPoint: addr(2), account: addr(1), now });
  assert.equal(validated.chainId, '420');
  assert.equal(validated.entryPoint, addr(2));
  assert.equal(validated.account, addr(1));
  assert.equal(validated.authority, 'funding-offer-only');
  assert.equal(validated.executionAuthorization, false);
});

test('attaches sponsorship before signing and verifies final canonical sponsored hash', async () => {
  const prepared = await prepareWalletGasSponsorship420({
    userOperation: unsignedOperation(),
    entryPoint: addr(2),
    discoverQuote: async (request) => {
      assert.equal(request.authority, 'funding-request-only');
      assert.equal(request.executionAuthorization, false);
      assert.equal(request.userOperation.signature, '0x');
      assert.equal(request.userOperation.paymasterAndData, '0x');
      return quote();
    },
    hashUserOperation: async (operation) => {
      assert.equal(operation.paymasterAndData, '0x123456');
      assert.equal(operation.signature, '0x');
      return hash(20);
    },
    now,
  });
  assert.equal(prepared.sponsored, true);
  assert.equal(prepared.fundingMode, 'paymaster');
  assert.equal(prepared.userOperation.paymasterAndData, '0x123456');
  assert.equal(prepared.userOpHash, hash(20));
  assert.equal(prepared.executionAuthorization, false);
});

test('falls back unchanged to self-funded execution when no quote is available', async () => {
  const operation = unsignedOperation();
  const prepared = await prepareWalletGasSponsorship420({
    userOperation: operation,
    entryPoint: addr(2),
    discoverQuote: async () => null,
    hashUserOperation: async () => { throw new Error('hash should not be needed for fallback'); },
    now,
  });
  assert.equal(prepared.sponsored, false);
  assert.equal(prepared.fundingMode, 'self-funded');
  assert.equal(prepared.userOperation.paymasterAndData, '0x');
  assert.equal(prepared.fallbackReason, 'SPONSORSHIP_UNAVAILABLE');
});

test('rejects quote if final sponsored operation hash does not match quote binding', async () => {
  await assert.rejects(() => prepareWalletGasSponsorship420({
    userOperation: unsignedOperation(),
    entryPoint: addr(2),
    discoverQuote: async () => quote(),
    hashUserOperation: async () => hash(21),
    now,
  }), /does not bind the final sponsored user operation/);
});

test('fails closed on wrong chain, EntryPoint, account, validity, or authority widening', () => {
  assert.throws(() => validateWalletGasQuote420(quote({ chainId: '421' }), { entryPoint: addr(2), account: addr(1), now }), GasSponsorshipError420);
  assert.throws(() => validateWalletGasQuote420(quote({ entryPoint: addr(9) }), { entryPoint: addr(2), account: addr(1), now }), GasSponsorshipError420);
  assert.throws(() => validateWalletGasQuote420(quote({ account: addr(9) }), { entryPoint: addr(2), account: addr(1), now }), GasSponsorshipError420);
  assert.throws(() => validateWalletGasQuote420(quote({ validUntil: '2026-09-14T23:29:59.000Z' }), { entryPoint: addr(2), account: addr(1), now }), /expired/);
  assert.throws(() => validateWalletGasQuote420(quote({ authority: 'execution-authority' }), { entryPoint: addr(2), account: addr(1), now }), GasSponsorshipError420);
  assert.throws(() => validateWalletGasQuote420(quote({ executionAuthorization: true }), { entryPoint: addr(2), account: addr(1), now }), GasSponsorshipError420);
});

test('Wallet will not attach sponsorship after signing or replace an existing paymaster payload', async () => {
  await assert.rejects(() => prepareWalletGasSponsorship420({
    userOperation: unsignedOperation({ signature: '0x12' }),
    entryPoint: addr(2), discoverQuote: async () => quote(), hashUserOperation: async () => hash(20), now,
  }), /before Wallet signing/);
  await assert.rejects(() => prepareWalletGasSponsorship420({
    userOperation: unsignedOperation({ paymasterAndData: '0x12' }),
    entryPoint: addr(2), discoverQuote: async () => quote(), hashUserOperation: async () => hash(20), now,
  }), /will not replace existing paymasterAndData/);
});

test('review state exposes bounded funding details but never implies execution authority', () => {
  const review = walletGasSponsorshipReview420({
    sponsored: true,
    fundingMode: 'paymaster',
    executionAuthorization: false,
    quote: quote(),
  });
  assert.equal(review.status, 'sponsored');
  assert.equal(review.fundingMode, 'paymaster');
  assert.equal(review.paymaster, addr(3));
  assert.equal(review.policyId, hash(11));
  assert.equal(review.maxSponsoredCostWei, '1000000000000000');
  assert.equal(review.executionAuthorization, false);
  assert.match(review.message, /Wallet or session authorization still controls execution/i);
});

test('self-funded review makes fallback explicit without changing transaction authority', () => {
  const review = walletGasSponsorshipReview420({
    sponsored: false,
    fundingMode: 'self-funded',
    fallbackReason: 'SPONSORSHIP_UNAVAILABLE',
  });
  assert.equal(review.status, 'self-funded');
  assert.equal(review.sponsored, false);
  assert.equal(review.paymaster, null);
  assert.equal(review.fallbackReason, 'SPONSORSHIP_UNAVAILABLE');
  assert.equal(review.executionAuthorization, false);
});

test('user-facing failure states distinguish safe self-funded fallback from a blocked funding path', () => {
  const fallback = walletGasSponsorshipFailure420(new Error('gas quote is expired'), { canSelfFund: true });
  assert.equal(fallback.code, 'SPONSORSHIP_EXPIRED');
  assert.equal(fallback.status, 'fallback-available');
  assert.equal(fallback.canSelfFund, true);
  assert.match(fallback.message, /same authorized operation/i);
  assert.equal(fallback.executionAuthorization, false);

  const blocked = walletGasSponsorshipFailure420(new Error('gas quote account mismatch'), { canSelfFund: false });
  assert.equal(blocked.code, 'SPONSORSHIP_ACCOUNT_MISMATCH');
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.canSelfFund, false);
  assert.equal(blocked.executionAuthorization, false);
});

test('review state fails closed if a sponsored result attempts to smuggle execution authority', () => {
  assert.throws(() => walletGasSponsorshipReview420({
    sponsored: true,
    fundingMode: 'paymaster',
    executionAuthorization: true,
    quote: quote(),
  }), /cannot grant execution authority/i);
});
