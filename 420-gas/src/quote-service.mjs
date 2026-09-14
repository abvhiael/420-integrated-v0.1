import { createHash } from 'node:crypto';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SCHEMA_VERSION = '1.0.0';
const DEFAULT_MAX_TTL_SECONDS = 300;

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
  assert420(typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value), `${name} must be a decimal string`);
  const parsed = BigInt(value);
  assert420(allowZero || parsed > 0n, `${name} must be greater than zero`);
  return parsed.toString(10);
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
    value.userOpHash,
    value.policyId,
    value.authorizationId,
    value.maxSponsoredCostWei,
    value.issuedAt,
    value.validAfter,
    value.validUntil
  ]);
}

export function validateGasQuoteCredential420(input, { now = new Date() } = {}) {
  const credential = object420(input, 'credential');
  exact420(credential, new Set(['applicationId', 'audience', 'scopes', 'expiresAt']), 'credential');
  const applicationId = id420(credential.applicationId, 'applicationId');
  const audience = id420(credential.audience, 'audience');
  assert420(audience === '420gas', 'credential audience must be 420gas');
  assert420(Array.isArray(credential.scopes) && credential.scopes.length > 0, 'credential scopes must be non-empty');
  const scopes = credential.scopes.map((scope, index) => text420(scope, `scopes[${index}]`, 128));
  assert420(new Set(scopes).size === scopes.length, 'credential scopes must be unique');
  assert420(scopes.includes('gas:quote'), 'credential requires gas:quote scope');
  const expiresAt = iso420(credential.expiresAt, 'expiresAt');
  assert420(Date.parse(expiresAt) > now.getTime(), 'credential is expired');
  return Object.freeze({ applicationId, audience, scopes: Object.freeze(scopes), expiresAt });
}

export function validateGasQuoteRequest420(input) {
  const request = object420(input, 'quote request');
  exact420(request, new Set([
    'schemaVersion', 'chainId', 'entryPoint', 'paymaster', 'account', 'userOpHash', 'policyId',
    'authorizationId', 'maxSponsoredCostWei', 'validAfter', 'validUntil'
  ]), 'quote request');
  assert420(request.schemaVersion === SCHEMA_VERSION, 'unsupported quote request schemaVersion');
  const chainId = uintString420(request.chainId, 'chainId');
  const entryPoint = address420(request.entryPoint, 'entryPoint');
  const paymaster = address420(request.paymaster, 'paymaster');
  const account = address420(request.account, 'account');
  const userOpHash = bytes32420(request.userOpHash, 'userOpHash');
  const policyId = bytes32420(request.policyId, 'policyId');
  const authorizationId = bytes32420(request.authorizationId, 'authorizationId');
  const maxSponsoredCostWei = uintString420(request.maxSponsoredCostWei, 'maxSponsoredCostWei');
  const validAfter = iso420(request.validAfter, 'validAfter');
  const validUntil = iso420(request.validUntil, 'validUntil');
  assert420(Date.parse(validUntil) > Date.parse(validAfter), 'validUntil must be after validAfter');
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, chainId, entryPoint, paymaster, account, userOpHash, policyId, authorizationId, maxSponsoredCostWei, validAfter, validUntil });
}

export function createGasQuote420({ request, credential, now = new Date(), maxTtlSeconds = DEFAULT_MAX_TTL_SECONDS, sign }) {
  assert420(Number.isInteger(maxTtlSeconds) && maxTtlSeconds > 0 && maxTtlSeconds <= 3600, 'maxTtlSeconds is invalid');
  const caller = validateGasQuoteCredential420(credential, { now });
  const quoteRequest = validateGasQuoteRequest420(request);
  const issuedAt = now.toISOString();
  const issuedMs = now.getTime();
  const validAfterMs = Date.parse(quoteRequest.validAfter);
  const validUntilMs = Date.parse(quoteRequest.validUntil);
  assert420(validAfterMs <= issuedMs, 'quote is not yet valid');
  assert420(validUntilMs > issuedMs, 'quote is expired');
  assert420(validUntilMs - issuedMs <= maxTtlSeconds * 1000, 'quote validity exceeds maximum TTL');
  assert420(typeof sign === 'function', 'quote signer is required');

  const unsigned = Object.freeze({ ...quoteRequest, issuedAt });
  const quoteCommitment = `0x${createHash('sha256').update(canonicalQuoteMaterial420(unsigned)).digest('hex')}`;
  const signature = sign({ quoteCommitment, quote: unsigned });
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
    sponsorSecretExposed: false
  });
}

export function createGasQuoteReadView420(quote, { credential, now = new Date() } = {}) {
  validateGasQuoteCredential420(credential, { now });
  const validated = validateGasQuoteRequest420(quote);
  return Object.freeze({
    quoteId: text420(quote.quoteId, 'quoteId', 66),
    chainId: validated.chainId,
    entryPoint: validated.entryPoint,
    paymaster: validated.paymaster,
    account: validated.account,
    userOpHash: validated.userOpHash,
    policyId: validated.policyId,
    authorizationId: validated.authorizationId,
    maxSponsoredCostWei: validated.maxSponsoredCostWei,
    validAfter: validated.validAfter,
    validUntil: validated.validUntil,
    authority: 'funding-offer-only',
    executionAuthorization: false,
    canonicalProtocolAuthority: false
  });
}
