import { normalizeAddress } from '../../web/core/abi.js';

const SNAPSHOT_KEY = 'wallet.lifecycle.snapshot.v1';

function normalizeChainId(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error('valid chain id required');
  return `0x${BigInt(value).toString(16)}`;
}

function normalizeAccounts(accounts = []) {
  if (!Array.isArray(accounts)) throw new TypeError('accounts must be an array');
  return accounts.map(normalizeAddress);
}

export async function readMobileLifecycleSnapshot420(runtime) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  const value = await runtime.secureStorage.get(SNAPSHOT_KEY);
  if (value == null) return null;
  if (!value || typeof value !== 'object') throw new Error('invalid mobile lifecycle snapshot');
  return {
    chainId: normalizeChainId(value.chainId),
    accounts: normalizeAccounts(value.accounts),
    authorizationEpoch: BigInt(value.authorizationEpoch ?? 0n),
    passkeyCredentialIdHash: value.passkeyCredentialIdHash ?? null,
  };
}

export async function writeMobileLifecycleSnapshot420(runtime, snapshot = {}) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  const normalized = Object.freeze({
    chainId: normalizeChainId(snapshot.chainId),
    accounts: normalizeAccounts(snapshot.accounts),
    authorizationEpoch: BigInt(snapshot.authorizationEpoch ?? 0n).toString(),
    passkeyCredentialIdHash: snapshot.passkeyCredentialIdHash ?? null,
  });
  await runtime.secureStorage.set(SNAPSHOT_KEY, normalized);
  return normalized;
}

export function diffMobileLifecycleSnapshot420(previous, current = {}) {
  const normalizedCurrent = {
    chainId: normalizeChainId(current.chainId),
    accounts: normalizeAccounts(current.accounts),
    authorizationEpoch: BigInt(current.authorizationEpoch ?? 0n),
    passkeyCredentialIdHash: current.passkeyCredentialIdHash ?? null,
  };
  if (!previous) {
    return Object.freeze({ firstRun: true, chainChanged: false, accountsChanged: false, authorizationEpochChanged: false, passkeyChanged: false, invalidateSessions: false, invalidatePasskey: false });
  }
  const chainChanged = normalizeChainId(previous.chainId) !== normalizedCurrent.chainId;
  const previousAccounts = normalizeAccounts(previous.accounts);
  const accountsChanged = previousAccounts.length !== normalizedCurrent.accounts.length || previousAccounts.some((value, index) => value !== normalizedCurrent.accounts[index]);
  const authorizationEpochChanged = BigInt(previous.authorizationEpoch ?? 0n) !== normalizedCurrent.authorizationEpoch;
  const passkeyChanged = (previous.passkeyCredentialIdHash ?? null) !== normalizedCurrent.passkeyCredentialIdHash;
  return Object.freeze({
    firstRun: false,
    chainChanged,
    accountsChanged,
    authorizationEpochChanged,
    passkeyChanged,
    invalidateSessions: chainChanged || accountsChanged || authorizationEpochChanged,
    invalidatePasskey: chainChanged || accountsChanged || authorizationEpochChanged || passkeyChanged,
  });
}

export async function hardenMobileResume420(runtime, current, handlers = {}) {
  const previous = await readMobileLifecycleSnapshot420(runtime);
  const diff = diffMobileLifecycleSnapshot420(previous, current);
  if (diff.invalidateSessions && typeof handlers.invalidateSessions === 'function') await handlers.invalidateSessions(diff);
  if (diff.invalidatePasskey && typeof handlers.invalidatePasskey === 'function') await handlers.invalidatePasskey(diff);
  await writeMobileLifecycleSnapshot420(runtime, current);
  return diff;
}

export async function clearMobileLifecycleSnapshot420(runtime) {
  if (!runtime?.secureStorage) throw new Error('mobile secure storage required');
  await runtime.secureStorage.delete(SNAPSHOT_KEY);
}
