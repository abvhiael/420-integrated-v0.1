import { normalizeAddress } from '../../web/core/abi.js';
import { normalizeMobileDappOrigin420 } from './dapp-connection.js';

const SESSION_KEY_PREFIX = 'wallet.dapp.session.v1:';

function keyFor(origin) {
  return `${SESSION_KEY_PREFIX}${encodeURIComponent(normalizeMobileDappOrigin420(origin))}`;
}

function normalizeAccounts(accounts = []) {
  if (!Array.isArray(accounts)) throw new TypeError('dApp accounts must be an array');
  return Object.freeze([...new Set(accounts.map(normalizeAddress))]);
}

function normalizeSession(value, expectedOrigin = null) {
  if (!value || typeof value !== 'object') throw new Error('invalid dApp approval session');
  const origin = normalizeMobileDappOrigin420(value.origin);
  if (expectedOrigin && origin !== normalizeMobileDappOrigin420(expectedOrigin)) throw new Error('dApp approval session origin mismatch');
  const createdAt = Number(value.createdAt);
  const updatedAt = Number(value.updatedAt);
  if (!Number.isFinite(createdAt) || createdAt <= 0 || !Number.isFinite(updatedAt) || updatedAt < createdAt) throw new Error('invalid dApp approval session timestamps');
  return Object.freeze({
    origin,
    accounts: normalizeAccounts(value.accounts),
    createdAt,
    updatedAt,
    connected: value.connected !== false,
  });
}

export async function readMobileDappSession420(runtime, origin) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  const value = await runtime.secureStorage.get(keyFor(origin));
  if (value == null) return null;
  const session = normalizeSession(value, origin);
  if (!session.connected) return null;
  return session;
}

export async function persistMobileDappSession420(runtime, origin, accounts, nowMs = Date.now()) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  const normalizedOrigin = normalizeMobileDappOrigin420(origin);
  const normalizedAccounts = normalizeAccounts(accounts);
  if (!normalizedAccounts.length) throw new Error('at least one approved dApp account required');
  const existing = await readMobileDappSession420(runtime, normalizedOrigin);
  const timestamp = Number(nowMs);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error('valid dApp session timestamp required');
  const session = Object.freeze({
    origin: normalizedOrigin,
    accounts: normalizedAccounts,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    connected: true,
  });
  await runtime.secureStorage.set(keyFor(normalizedOrigin), session);
  return session;
}

export async function disconnectMobileDappSession420(runtime, origin) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  const normalizedOrigin = normalizeMobileDappOrigin420(origin);
  await runtime.secureStorage.delete(keyFor(normalizedOrigin));
  return Object.freeze({ origin: normalizedOrigin, disconnected: true });
}

export async function assertMobileDappSessionAccount420(runtime, origin, account) {
  const session = await readMobileDappSession420(runtime, origin);
  if (!session) throw Object.assign(new Error('dApp is not connected to 420 Wallet'), { code: 4100 });
  const normalized = normalizeAddress(account);
  if (!session.accounts.includes(normalized)) throw Object.assign(new Error('dApp is not authorized for this wallet account'), { code: 4100 });
  return normalized;
}
