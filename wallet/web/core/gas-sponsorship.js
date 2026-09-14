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
    userOpHash: bytes32420(quote.userOpHash, 'userOpHash'),
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

export async function prepareWalletGasSponsorship420({
  userOperation,
  entryPoint,
  discoverQuote,
  hashUserOperation,
  now = new Date(),
} = {}) {
  assert420(userOperation && typeof userOperation === 'object', 'unsigned user operation is required');
  const signature = normalizeCallData(userOperation.signature ?? '0x');
  const paymasterAndData = normalizeCallData(userOperation.paymasterAndData ?? '0x');
  assert420(signature === '0x', 'sponsorship must be prepared before Wallet signing');
  assert420(paymasterAndData === '0x', 'Wallet will not replace existing paymasterAndData');
  assert420(typeof discoverQuote === 'function', 'sponsorship quote discovery function is required');
  assert420(typeof hashUserOperation === 'function', 'canonical user operation hash function is required');

  const request = Object.freeze({
    chainId: '420',
    entryPoint: normalizeAddress(entryPoint),
    account: normalizeAddress(userOperation.sender),
    userOperation: Object.freeze({ ...userOperation, signature: '0x', paymasterAndData: '0x' }),
    authority: 'funding-request-only',
    executionAuthorization: false,
  });

  const discovered = await discoverQuote(request);
  if (discovered == null) {
    return Object.freeze({
      sponsored: false,
      fundingMode: 'self-funded',
      userOperation: request.userOperation,
      quote: null,
      fallbackReason: 'SPONSORSHIP_UNAVAILABLE',
    });
  }

  const quote = validateWalletGasQuote420(discovered, {
    entryPoint: request.entryPoint,
    account: request.account,
    now,
  });
  const sponsoredOperation = Object.freeze({ ...request.userOperation, paymasterAndData: quote.paymasterAndData });
  const canonicalHash = bytes32420(await hashUserOperation(sponsoredOperation), 'canonical sponsored userOpHash');
  assert420(canonicalHash === quote.userOpHash, 'gas quote does not bind the final sponsored user operation');

  return Object.freeze({
    sponsored: true,
    fundingMode: 'paymaster',
    userOperation: sponsoredOperation,
    quote,
    userOpHash: canonicalHash,
    fallbackReason: null,
    authority: 'funding-only',
    executionAuthorization: false,
  });
}
