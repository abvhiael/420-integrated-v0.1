import { normalizeAddress } from '../../web/core/abi.js';
import { createDappPermission420, normalizeDappPermission420, assertDappPermissionActive420, touchDappPermission420 } from '../../web/core/dapp-permissions.js';
import { normalizeMobileDappOrigin420 } from './dapp-connection.js';

const SESSION_KEY_PREFIX = 'wallet.dapp.session.v1:';

function keyFor(origin) {
  return `${SESSION_KEY_PREFIX}${encodeURIComponent(normalizeMobileDappOrigin420(origin))}`;
}

function normalizeSession(value, expectedOrigin = null, nowMs = Date.now()) {
  if (!value || typeof value !== 'object') throw new Error('invalid dApp approval session');
  const origin = normalizeMobileDappOrigin420(value.origin);
  if (expectedOrigin && origin !== normalizeMobileDappOrigin420(expectedOrigin)) throw new Error('dApp approval session origin mismatch');
  const legacy = value.grantedAt ? value : {
    origin,
    accounts: value.accounts,
    grantedAt: value.createdAt,
    lastUsedAt: value.updatedAt,
    chainId: value.chainId ?? null,
    sessionScopes: value.sessionScopes ?? [],
    expiresAt: value.expiresAt ?? null,
  };
  return assertDappPermissionActive420(normalizeDappPermission420(legacy), { origin, nowMs });
}

export async function readMobileDappSession420(runtime, origin, { chainId = null, nowMs = Date.now() } = {}) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  const value = await runtime.secureStorage.get(keyFor(origin));
  if (value == null) return null;
  const session = normalizeSession(value, origin, nowMs);
  return assertDappPermissionActive420(session, { origin, chainId, nowMs });
}

export async function persistMobileDappSession420(runtime, origin, accounts, nowMs = Date.now(), options = {}) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  const normalizedOrigin = normalizeMobileDappOrigin420(origin);
  const existing = await readMobileDappSession420(runtime, normalizedOrigin, { nowMs }).catch(() => null);
  const permission = createDappPermission420({
    origin: normalizedOrigin,
    accounts,
    chainId: options.chainId ?? existing?.chainId ?? null,
    sessionScopes: options.sessionScopes ?? existing?.sessionScopes ?? [],
    grantedAt: existing?.grantedAt ?? nowMs,
    lastUsedAt: nowMs,
    expiresAt: options.expiresAt ?? existing?.expiresAt ?? null,
  });
  await runtime.secureStorage.set(keyFor(normalizedOrigin), { ...permission, accounts: [...permission.accounts], sessionScopes: [...permission.sessionScopes] });
  return permission;
}

export async function touchMobileDappSession420(runtime, origin, nowMs = Date.now()) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  const current = await readMobileDappSession420(runtime, origin, { nowMs });
  if (!current) return null;
  const touched = touchDappPermission420(current, nowMs);
  await runtime.secureStorage.set(keyFor(origin), { ...touched, accounts: [...touched.accounts], sessionScopes: [...touched.sessionScopes] });
  return touched;
}

export async function disconnectMobileDappSession420(runtime, origin) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  const normalizedOrigin = normalizeMobileDappOrigin420(origin);
  await runtime.secureStorage.delete(keyFor(normalizedOrigin));
  return Object.freeze({ origin: normalizedOrigin, disconnected: true });
}

export async function assertMobileDappSessionAccount420(runtime, origin, account, options = {}) {
  const session = await readMobileDappSession420(runtime, origin, options);
  if (!session) throw Object.assign(new Error('dApp is not connected to 420 Wallet'), { code: 4100 });
  const normalized = normalizeAddress(account);
  assertDappPermissionActive420(session, { origin, account: normalized, chainId: options.chainId, nowMs: options.nowMs ?? Date.now() });
  return normalized;
}
