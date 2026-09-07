import { normalizeAddress } from './abi.js';

function normalizeOrigin(value, { allowLocalHttp = false } = {}) {
  if (typeof value !== 'string' || !value) throw new TypeError('origin required');
  let url;
  try { url = new URL(value); } catch { throw new TypeError('invalid origin'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowLocalHttp && url.protocol === 'http:' && local)) throw new TypeError('insecure origin');
  return url.origin;
}

function normalizeAccounts(accounts = []) {
  if (!Array.isArray(accounts)) throw new TypeError('accounts array required');
  return Object.freeze([...new Set(accounts.map(normalizeAddress))]);
}

function normalizeChainId(chainId) {
  if (chainId == null || chainId === '') return null;
  try {
    const value = BigInt(chainId);
    if (value <= 0n) throw new Error();
    return `0x${value.toString(16)}`;
  } catch {
    throw new TypeError('valid chain id required');
  }
}

function normalizeScopes(scopes = []) {
  if (!Array.isArray(scopes)) throw new TypeError('session scopes array required');
  return Object.freeze([...new Set(scopes.map((scope) => {
    if (typeof scope !== 'string' || !scope || scope.length > 256) throw new TypeError('valid session scope required');
    return scope;
  }))].sort());
}

function normalizeTimestamp(value, label, { optional = false } = {}) {
  if (value == null && optional) return null;
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new TypeError(`${label} required`);
  return timestamp;
}

export function createDappPermission420({
  origin,
  accounts,
  chainId = null,
  sessionScopes = [],
  grantedAt = Date.now(),
  lastUsedAt = grantedAt,
  expiresAt = null,
  allowLocalHttp = false,
} = {}) {
  const normalizedOrigin = normalizeOrigin(origin, { allowLocalHttp });
  const normalizedAccounts = normalizeAccounts(accounts);
  if (!normalizedAccounts.length) throw new TypeError('at least one approved dApp account required');
  const granted = normalizeTimestamp(grantedAt, 'grant timestamp');
  const lastUsed = normalizeTimestamp(lastUsedAt, 'last-used timestamp');
  if (lastUsed < granted) throw new TypeError('last-used timestamp cannot precede grant');
  const expiry = normalizeTimestamp(expiresAt, 'expiry timestamp', { optional: true });
  if (expiry !== null && expiry <= granted) throw new TypeError('expiry must be after grant');
  return Object.freeze({
    origin: normalizedOrigin,
    accounts: normalizedAccounts,
    chainId: normalizeChainId(chainId),
    sessionScopes: normalizeScopes(sessionScopes),
    grantedAt: granted,
    lastUsedAt: lastUsed,
    expiresAt: expiry,
  });
}

export function normalizeDappPermission420(value, options = {}) {
  if (!value || typeof value !== 'object') throw new TypeError('dApp permission required');
  return createDappPermission420({ ...value, allowLocalHttp: options.allowLocalHttp });
}

export function assertDappPermissionActive420(permission, { origin, account = null, chainId = null, nowMs = Date.now(), allowLocalHttp = false } = {}) {
  const normalized = normalizeDappPermission420(permission, { allowLocalHttp });
  if (origin && normalized.origin !== normalizeOrigin(origin, { allowLocalHttp })) throw Object.assign(new Error('dApp permission origin mismatch'), { code: 4100 });
  if (account && !normalized.accounts.includes(normalizeAddress(account))) throw Object.assign(new Error('dApp account is not permitted'), { code: 4100 });
  const expectedChain = normalizeChainId(chainId);
  if (expectedChain && normalized.chainId && normalized.chainId !== expectedChain) throw Object.assign(new Error('dApp permission network mismatch'), { code: 4100 });
  const now = Number(nowMs);
  if (!Number.isFinite(now) || now <= 0) throw new TypeError('valid current time required');
  if (normalized.expiresAt !== null && now >= normalized.expiresAt) throw Object.assign(new Error('dApp permission expired'), { code: 4100 });
  return normalized;
}

export function touchDappPermission420(permission, nowMs = Date.now(), options = {}) {
  const normalized = normalizeDappPermission420(permission, options);
  const now = normalizeTimestamp(nowMs, 'last-used timestamp');
  if (now < normalized.grantedAt) throw new TypeError('last-used timestamp cannot precede grant');
  return Object.freeze({ ...normalized, lastUsedAt: now });
}

export const normalizeDappPermissionOrigin420 = normalizeOrigin;
