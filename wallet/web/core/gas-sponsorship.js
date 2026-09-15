import { normalizeAddress } from './abi.js';
import { normalizeCallData } from './execution.js';

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

export class GasSponsorshipError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'GasSponsorshipError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new GasSponsorshipError420(message);
}

function bytes32420(value, name) {
  assert420(typeof value === 'string' && BYTES32_RE.test(value), `${name} must be bytes32`);
  return value.toLowerCase();
}

function decimal420(value, name) {
  assert420(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value), `${name} must be a decimal string`);
  return BigInt(value).toString(10);
}

function timestamp420(value, name) {
  const ms = Date.parse(value);
  assert420(Number.isFinite(ms), `${name} must be an ISO date-time`);
  return ms;
}

export function validateWalletGasQuote420(quote, { entryPoint, account, now = new Date() } = {}) {
  assert420(quote && typeof quote === 'object' && !Array.isArray(quote), 'gas quote must be an object');
  const normalized = {
    quoteId: bytes32420(quote.quoteId, 'quoteId'),
    chainId: decimal420(quote.chainId, 'chainId'),
    entryPoint: normalizeAddress(quote.entryPoint),
    paymaster: normalizeAddress(quote.paymaster),
    account: normalizeAddress(quote.account),
    sponsorshipDigest: bytes32420(quote.sponsorshipDigest, 'sponsorshipDigest'),
    policyId: bytes32420(quote.policyId, 'policyId'),
    authorizationId: bytes32420(quote.authorizationId, 'authorizationId'),
    maxSponsoredCostWei: decimal420(quote.maxSponsoredCostWei, 'maxSponsoredCostWei'),
    validAfter: quote.validAfter,
    validUntil: quote.validUntil,
    paymasterAndData: normalizeCallData(quote.paymasterAndData),
    authority: quote.authority,
    executionAuthorization: quote.executionAuthorization,
  };
  assert420(normalized.chainId === '420', 'gas quote is bound to the wrong chain');
  assert420(normalized.entryPoint === normalizeAddress(entryPoint), 'gas quote EntryPoint mismatch');
  assert420(normalized.account === normalizeAddress(account), 'gas quote account mismatch');
  assert420(normalized.paymasterAndData !== '0x', 'gas quote is missing paymasterAndData');
  assert420(normalized.authority === 'funding-offer-only', 'gas quote authority is invalid');
  assert420(normalized.executionAuthorization === false, 'gas quote must not grant execution authority');
  const at = now.getTime();
  assert420(timestamp420(normalized.validAfter, 'validAfter') <= at, 'gas quote is not yet valid');
  assert420(timestamp420(normalized.validUntil, 'validUntil') > at, 'gas quote is expired');
  return Object.freeze(normalized);
}

export function walletGasSponsorshipReview420(prepared) {
  assert420(prepared && typeof prepared === 'object', 'prepared sponsorship state is required');
  const sponsored = prepared.sponsored === true;
  if (!sponsored) {
    assert420(prepared.fundingMode === 'self-funded', 'self-funded sponsorship state is invalid');
    return Object.freeze({
      status: 'self-funded', fundingMode: 'self-funded', sponsored: false, title: 'You pay network gas',
      message: 'No gas sponsorship is attached. Wallet authorization and transaction details are unchanged.',
      paymaster: null, policyId: null, maxSponsoredCostWei: null, validUntil: null,
      executionAuthorization: false, fallbackReason: prepared.fallbackReason ?? null,
    });
  }
  assert420(prepared.fundingMode === 'paymaster', 'sponsored funding mode is invalid');
  assert420(prepared.executionAuthorization === false, 'sponsorship review cannot grant execution authority');
  assert420(prepared.quote && typeof prepared.quote === 'object', 'sponsored quote is required for review');
  return Object.freeze({
    status: 'sponsored', fundingMode: 'paymaster', sponsored: true, title: 'Network gas is sponsored',
    message: 'A paymaster may fund this exact operation. Your Wallet or session authorization still controls execution.',
    paymaster: normalizeAddress(prepared.quote.paymaster),
    policyId: bytes32420(prepared.quote.policyId, 'policyId'),
    maxSponsoredCostWei: decimal420(prepared.quote.maxSponsoredCostWei, 'maxSponsoredCostWei'),
    validUntil: prepared.quote.validUntil, executionAuthorization: false, fallbackReason: null,
  });
}

export function walletGasSponsorshipFailure420(error, { canSelfFund = true } = {}) {
  const message = String(error?.message || error || 'gas sponsorship failed');
  let code = 'SPONSORSHIP_FAILED';
  if (/expired/i.test(message)) code = 'SPONSORSHIP_EXPIRED';
  else if (/not yet valid/i.test(message)) code = 'SPONSORSHIP_NOT_YET_VALID';
  else if (/wrong chain|chain/i.test(message)) code = 'SPONSORSHIP_WRONG_CHAIN';
  else if (/EntryPoint mismatch/i.test(message)) code = 'SPONSORSHIP_ENTRYPOINT_MISMATCH';
  else if (/account mismatch/i.test(message)) code = 'SPONSORSHIP_ACCOUNT_MISMATCH';
  else if (/sponsorship digest/i.test(message)) code = 'SPONSORSHIP_OPERATION_MISMATCH';
  else if (/authority|execution authority/i.test(message)) code = 'SPONSORSHIP_AUTHORITY_INVALID';
  else if (/unavailable/i.test(message)) code = 'SPONSORSHIP_UNAVAILABLE';
  return Object.freeze({
    status: canSelfFund ? 'fallback-available' : 'blocked', code,
    title: canSelfFund ? 'Gas sponsorship unavailable' : 'Transaction cannot continue',
    message: canSelfFund
      ? 'The sponsorship offer cannot be used. You can continue with the same authorized operation and pay network gas yourself.'
      : 'The sponsorship offer cannot be used and this Wallet cannot safely continue without another valid funding path.',
    canSelfFund: Boolean(canSelfFund), executionAuthorization: false,
  });
}

export async function prepareWalletGasSponsorship420({
  userOperation,
  entryPoint,
  discoverQuote,
  hashSponsorship,
  hashUserOperation,
  now = new Date(),
} = {}) {
  assert420(userOperation && typeof userOperation === 'object', 'unsigned user operation is required');
  const signature = normalizeCallData(userOperation.signature ?? '0x');
  const paymasterAndData = normalizeCallData(userOperation.paymasterAndData ?? '0x');
  assert420(signature === '0x', 'sponsorship must be prepared before Wallet signing');
  assert420(paymasterAndData === '0x', 'Wallet will not replace existing paymasterAndData');
  assert420(typeof discoverQuote === 'function', 'sponsorship quote discovery function is required');
  assert420(typeof hashSponsorship === 'function', 'canonical sponsorship digest function is required');
  assert420(typeof hashUserOperation === 'function', 'canonical user operation hash function is required');

  const request = Object.freeze({
    chainId: '420', entryPoint: normalizeAddress(entryPoint), account: normalizeAddress(userOperation.sender),
    userOperation: Object.freeze({ ...userOperation, signature: '0x', paymasterAndData: '0x' }),
    authority: 'funding-request-only', executionAuthorization: false,
  });

  const discovered = await discoverQuote(request);
  if (discovered == null) {
    return Object.freeze({ sponsored: false, fundingMode: 'self-funded', userOperation: request.userOperation, quote: null, fallbackReason: 'SPONSORSHIP_UNAVAILABLE' });
  }

  const quote = validateWalletGasQuote420(discovered, { entryPoint: request.entryPoint, account: request.account, now });
  const sponsoredOperation = Object.freeze({ ...request.userOperation, paymasterAndData: quote.paymasterAndData });
  const sponsorshipDigest = bytes32420(await hashSponsorship(sponsoredOperation), 'canonical sponsorship digest');
  assert420(sponsorshipDigest === quote.sponsorshipDigest, 'gas quote sponsorship digest mismatch');
  const canonicalHash = bytes32420(await hashUserOperation(sponsoredOperation), 'canonical sponsored userOpHash');

  return Object.freeze({
    sponsored: true, fundingMode: 'paymaster', userOperation: sponsoredOperation, quote,
    sponsorshipDigest, userOpHash: canonicalHash, fallbackReason: null, authority: 'funding-only', executionAuthorization: false,
  });
}
