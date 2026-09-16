import { createHash } from 'node:crypto';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SCHEMA_VERSION = '1.2.0';
const DEFAULT_MAX_TTL_SECONDS = 300;
const MAX_UINT256_420 = (1n << 256n) - 1n;
const MAX_UINT256_DECIMAL_DIGITS_420 = 78;
const MAX_CREDENTIAL_SCOPES_420 = 16;

export const DEFAULT_GAS_ECONOMIC_LIMITS_420 = Object.freeze({
  maxGasLimit: 30_000_000n,
  maxFeePerGasWei: 1_000_000_000_000_000n,
  maxPriorityFeePerGasWei: 100_000_000_000_000n,
});

export class GasQuoteError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'GasQuoteError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new GasQuoteError420(message);
}

function object420(value, name) {
  assert420(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value;
}

function exact420(value, keys, name) {
  for (const key of Object.keys(value)) assert420(keys.has(key), `${name} contains unsupported field: ${key}`);
}

function text420(value, name, max = 256) {
  assert420(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${name} is invalid`);
  return value.trim();
}

function id420(value, name) {
  const value420 = text420(value, name, 64);
  assert420(ID_RE.test(value420), `${name} is invalid`);
  return value420;
}

function address420(value, name) {
  const value420 = text420(value, name, 42);
  assert420(ADDRESS_RE.test(value420), `${name} must be an address`);
  return value420.toLowerCase();
}

function bytes32420(value, name) {
  const value420 = text420(value, name, 66);
  assert420(BYTES32_RE.test(value420), `${name} must be bytes32`);
  return value420.toLowerCase();
}

function uintString420(value, name, { allowZero = false } = {}) {
  assert420(
    typeof value === 'string'
      && value.length <= MAX_UINT256_DECIMAL_DIGITS_420
      && /^(0|[1-9][0-9]*)$/.test(value),
    `${name} must be a uint256 decimal string`,
  );
  const parsed = BigInt(value);
  assert420(parsed <= MAX_UINT256_420, `${name} exceeds uint256`);
  assert420(allowZero || parsed > 0n, `${name} must be greater than zero`);
  return parsed.toString(10);
}

function positiveBigInt420(value, name) {
  let parsed = -1n;
  if (typeof value === 'bigint') {
    parsed = value;
  } else if (
    typeof value === 'string'
      && value.length <= MAX_UINT256_DECIMAL_DIGITS_420
      && /^(0|[1-9][0-9]*)$/.test(value)
  ) {
    parsed = BigInt(value);
  }
  assert420(parsed > 0n && parsed <= MAX_UINT256_420, `${name} must be a positive uint256`);
  return parsed;
}

function iso420(value, name) {
  const string = text420(value, name, 64);
  const ms = Date.parse(string);
  assert420(Number.isFinite(ms), `${name} must be an ISO date-time`);
  return new Date(ms).toISOString();
}

function canonicalQuoteMaterial420(value) {
  return JSON.stringify([
    value.schemaVersion,
    value.chainId,
    value.entryPoint,
    value.paymaster,
    value.account,
    value.sponsorshipDigest,
    value.policyId,
    value.authorizationId,
    value.maxSponsoredCostWei,
    value.gasLimit,
    value.maxFeePerGasWei,
    value.maxPriorityFeePerGasWei,
    value.issuedAt,
    value.validAfter,
    value.validUntil
  ]);
}

function requestProjection420(value) {
  return {
    schemaVersion: value.schemaVersion,
    chainId: value.chainId,
    entryPoint: value.entryPoint,
    paymaster: value.paymaster,
    account: value.account,
    sponsorshipDigest: value.sponsorshipDigest,
    policyId: value.policyId,
    authorizationId: value.authorizationId,
    maxSponsoredCostWei: value.maxSponsoredCostWei,
    gasLimit: value.gasLimit,
    maxFeePerGasWei: value.maxFeePerGasWei,
    maxPriorityFeePerGasWei: value.maxPriorityFeePerGasWei,
    validAfter: value.validAfter,
    validUntil: value.validUntil
  };
}

function quotaController420(value) {
  if (value === undefined || value === null) return null;
  assert420(typeof value === 'object' && typeof value.reserve === 'function' && typeof value.release === 'function' && typeof value.rollback === 'function', 'quotaController is invalid');
  return value;
}

function quotaHandle420(reservation) {
  assert420(reservation && typeof reservation === 'object', 'quota reservation is required');
  const authorizationId = bytes32420(reservation.authorizationId, 'quota authorizationId');
  assert420(Number.isSafeInteger(reservation.reservationId) && reservation.reservationId > 0, 'quota reservationId is invalid');
  return Object.freeze({ authorizationId, reservationId: reservation.reservationId });
}

export function validateGasEconomicLimits420(input = {}) {
  const limits = object420(input, 'economic limits');
  exact420(limits, new Set(['maxGasLimit', 'maxFeePerGasWei', 'maxPriorityFeePerGasWei']), 'economic limits');
  return Object.freeze({
    maxGasLimit: positiveBigInt420(limits.maxGasLimit ?? DEFAULT_GAS_ECONOMIC_LIMITS_420.maxGasLimit, 'maxGasLimit'),
    maxFeePerGasWei: positiveBigInt420(limits.maxFeePerGasWei ?? DEFAULT_GAS_ECONOMIC_LIMITS_420.maxFeePerGasWei, 'maxFeePerGasWei limit'),
    maxPriorityFeePerGasWei: positiveBigInt420(limits.maxPriorityFeePerGasWei ?? DEFAULT_GAS_ECONOMIC_LIMITS_420.maxPriorityFeePerGasWei, 'maxPriorityFeePerGasWei limit'),
  });
}

export function validateGasQuoteCredential420(input, { now = new Date(), requiredScope = 'gas:quote' } = {}) {
  const credential = object420(input, 'credential');
  exact420(credential, new Set(['applicationId', 'audience', 'scopes', 'expiresAt']), 'credential');
  const applicationId = id420(credential.applicationId, 'applicationId');
  const audience = id420(credential.audience, 'audience');
  assert420(audience === '420gas', 'credential audience must be 420gas');
  assert420(
    Array.isArray(credential.scopes)
      && credential.scopes.length > 0
      && credential.scopes.length <= MAX_CREDENTIAL_SCOPES_420,
    'credential scopes must contain between 1 and 16 entries',
  );
  const scopes = credential.scopes.map((scope, index) => text420(scope, `scopes[${index}]`, 128));
  assert420(new Set(scopes).size === scopes.length, 'credential scopes must be unique');
  assert420(requiredScope === 'gas:quote' || requiredScope === 'gas:read', 'required credential scope is invalid');
  assert420(scopes.includes(requiredScope), `credential requires ${requiredScope} scope`);
  const expiresAt = iso420(credential.expiresAt, 'expiresAt');
  assert420(Date.parse(expiresAt) > now.getTime(), 'credential is expired');
  return Object.freeze({ applicationId, audience, scopes: Object.freeze(scopes), expiresAt });
}

export function validateGasQuoteRequest420(input) {
  const request = object420(input, 'quote request');
  exact420(request, new Set([
    'schemaVersion', 'chainId', 'entryPoint', 'paymaster', 'account', 'sponsorshipDigest', 'policyId',
    'authorizationId', 'maxSponsoredCostWei', 'gasLimit', 'maxFeePerGasWei', 'maxPriorityFeePerGasWei',
    'validAfter', 'validUntil'
  ]), 'quote request');
  assert420(request.schemaVersion === SCHEMA_VERSION, 'unsupported quote request schemaVersion');
  const chainId = uintString420(request.chainId, 'chainId');
  const entryPoint = address420(request.entryPoint, 'entryPoint');
  const paymaster = address420(request.paymaster, 'paymaster');
  const account = address420(request.account, 'account');
  const sponsorshipDigest = bytes32420(request.sponsorshipDigest, 'sponsorshipDigest');
  const policyId = bytes32420(request.policyId, 'policyId');
  const authorizationId = bytes32420(request.authorizationId, 'authorizationId');
  const maxSponsoredCostWei = uintString420(request.maxSponsoredCostWei, 'maxSponsoredCostWei');
  const gasLimit = uintString420(request.gasLimit, 'gasLimit');
  const maxFeePerGasWei = uintString420(request.maxFeePerGasWei, 'maxFeePerGasWei');
  const maxPriorityFeePerGasWei = uintString420(request.maxPriorityFeePerGasWei, 'maxPriorityFeePerGasWei', { allowZero: true });
  assert420(BigInt(maxPriorityFeePerGasWei) <= BigInt(maxFeePerGasWei), 'maxPriorityFeePerGasWei exceeds maxFeePerGasWei');
  const validAfter = iso420(request.validAfter, 'validAfter');
  const validUntil = iso420(request.validUntil, 'validUntil');
  assert420(Date.parse(validUntil) > Date.parse(validAfter), 'validUntil must be after validAfter');
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, chainId, entryPoint, paymaster, account, sponsorshipDigest, policyId, authorizationId, maxSponsoredCostWei, gasLimit, maxFeePerGasWei, maxPriorityFeePerGasWei, validAfter, validUntil });
}

export function enforceGasQuoteEconomicLimits420(request, limits = {}) {
  const economic = validateGasEconomicLimits420(limits);
  assert420(BigInt(request.gasLimit) <= economic.maxGasLimit, 'gasLimit exceeds sponsor ceiling');
  assert420(BigInt(request.maxFeePerGasWei) <= economic.maxFeePerGasWei, 'maxFeePerGasWei exceeds sponsor ceiling');
  assert420(BigInt(request.maxPriorityFeePerGasWei) <= economic.maxPriorityFeePerGasWei, 'maxPriorityFeePerGasWei exceeds sponsor ceiling');
  return economic;
}

export function createGasQuote420({ request, credential, now = new Date(), maxTtlSeconds = DEFAULT_MAX_TTL_SECONDS, sign, quotaController, economicLimits = {} }) {
  assert420(Number.isInteger(maxTtlSeconds) && maxTtlSeconds > 0 && maxTtlSeconds <= 3600, 'maxTtlSeconds is invalid');
  const caller = validateGasQuoteCredential420(credential, { now, requiredScope: 'gas:quote' });
  const quoteRequest = validateGasQuoteRequest420(request);
  enforceGasQuoteEconomicLimits420(quoteRequest, economicLimits);
  const issuedAt = now.toISOString();
  const issuedMs = now.getTime();
  const validAfterMs = Date.parse(quoteRequest.validAfter);
  const validUntilMs = Date.parse(quoteRequest.validUntil);
  assert420(validAfterMs <= issuedMs, 'quote is not yet valid');
  assert420(validUntilMs > issuedMs, 'quote is expired');
  assert420(validUntilMs - issuedMs <= maxTtlSeconds * 1000, 'quote validity exceeds maximum TTL');
  assert420(typeof sign === 'function', 'quote signer is required');

  const quota = quotaController420(quotaController);
  let reservation = null;
  if (quota) {
    reservation = quota.reserve({
      account: quoteRequest.account,
      policyId: quoteRequest.policyId,
      authorizationId: quoteRequest.authorizationId,
      maxSponsoredCostWei: quoteRequest.maxSponsoredCostWei,
      nowMs: issuedMs,
      expiresAtMs: validUntilMs,
    });
  }

  try {
    const unsigned = Object.freeze({ ...quoteRequest, issuedAt });
    const quoteCommitment = `0x${createHash('sha256').update(canonicalQuoteMaterial420(unsigned)).digest('hex')}`;
    const signature = sign({ sponsorshipDigest: unsigned.sponsorshipDigest, quoteCommitment, quote: unsigned });
    assert420(typeof signature === 'string' && signature.length > 0 && signature.length <= 4096, 'quote signer returned invalid signature');

    return Object.freeze({
      ...unsigned,
      quoteId: quoteCommitment,
      quoteCommitment,
      signature,
      issuedToApplicationId: caller.applicationId,
      fundingMode: 'paymaster',
      authority: 'funding-offer-only',
      executionAuthorization: false,
      walletAuthorization: false,
      targetProtocolAuthorization: false,
      canonicalProtocolAuthority: false,
      sponsorSecretExposed: false,
      quotaReservation: reservation,
    });
  } catch (error) {
    if (quota && reservation) quota.rollback(quotaHandle420(reservation));
    throw error;
  }
}

export function releaseGasQuoteQuota420({ quotaController, quotaReservation }) {
  const quota = quotaController420(quotaController);
  assert420(quota !== null, 'quotaController is required');
  return quota.release(quotaHandle420(quotaReservation));
}

export function createGasQuoteReadView420(quote, { credential, now = new Date() } = {}) {
  validateGasQuoteCredential420(credential, { now, requiredScope: 'gas:read' });
  const validated = validateGasQuoteRequest420(requestProjection420(quote));
  return Object.freeze({
    quoteId: bytes32420(quote.quoteId, 'quoteId'),
    chainId: validated.chainId,
    entryPoint: validated.entryPoint,
    paymaster: validated.paymaster,
    account: validated.account,
    sponsorshipDigest: validated.sponsorshipDigest,
    policyId: validated.policyId,
    authorizationId: validated.authorizationId,
    maxSponsoredCostWei: validated.maxSponsoredCostWei,
    gasLimit: validated.gasLimit,
    maxFeePerGasWei: validated.maxFeePerGasWei,
    maxPriorityFeePerGasWei: validated.maxPriorityFeePerGasWei,
    validAfter: validated.validAfter,
    validUntil: validated.validUntil,
    authority: 'funding-offer-only',
    executionAuthorization: false,
    canonicalProtocolAuthority: false
  });
}
