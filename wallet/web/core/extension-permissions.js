import { createDappPermission420, normalizeDappPermission420, assertDappPermissionActive420, touchDappPermission420, normalizeDappPermissionOrigin420 } from './dapp-permissions.js';

const STORAGE_KEY = '420-wallet-origin-permissions-v1';

export class OriginPermissionStore420 {
  constructor(storageArea, storageKey = STORAGE_KEY) {
    if (!storageArea || typeof storageArea.get !== 'function' || typeof storageArea.set !== 'function') {
      throw new Error('extension storage area required');
    }
    this.storageArea = storageArea;
    this.storageKey = storageKey;
  }

  async readAll() {
    const stored = await this.storageArea.get(this.storageKey);
    const value = stored?.[this.storageKey];
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  async permissionFor(origin, { chainId = null, nowMs = Date.now() } = {}) {
    const key = normalizeDappPermissionOrigin420(origin, { allowLocalHttp: true });
    const permissions = await this.readAll();
    const raw = permissions[key];
    if (!raw) return null;
    try {
      const legacy = raw.origin ? raw : {
        origin: key,
        accounts: raw.accounts,
        grantedAt: raw.grantedAt,
        lastUsedAt: raw.lastUsedAt ?? raw.grantedAt,
        chainId: raw.chainId ?? null,
        sessionScopes: raw.sessionScopes ?? [],
        expiresAt: raw.expiresAt ?? null,
      };
      return assertDappPermissionActive420(legacy, { origin: key, chainId, nowMs, allowLocalHttp: true });
    } catch {
      return null;
    }
  }

  async accountsFor(origin, options = {}) {
    return [...((await this.permissionFor(origin, options))?.accounts ?? [])];
  }

  async grant(origin, accounts, { chainId = null, sessionScopes = [], expiresAt = null, nowMs = Date.now() } = {}) {
    const permission = createDappPermission420({
      origin,
      accounts,
      chainId,
      sessionScopes,
      grantedAt: nowMs,
      lastUsedAt: nowMs,
      expiresAt,
      allowLocalHttp: true,
    });
    const permissions = await this.readAll();
    permissions[permission.origin] = { ...permission, accounts: [...permission.accounts], sessionScopes: [...permission.sessionScopes] };
    await this.storageArea.set({ [this.storageKey]: permissions });
    return [...permission.accounts];
  }

  async touch(origin, nowMs = Date.now()) {
    const key = normalizeDappPermissionOrigin420(origin, { allowLocalHttp: true });
    const permissions = await this.readAll();
    const existing = permissions[key];
    if (!existing) return false;
    const normalized = normalizeDappPermission420(existing.origin ? existing : {
      origin: key,
      accounts: existing.accounts,
      grantedAt: existing.grantedAt,
      lastUsedAt: existing.lastUsedAt ?? existing.grantedAt,
      chainId: existing.chainId ?? null,
      sessionScopes: existing.sessionScopes ?? [],
      expiresAt: existing.expiresAt ?? null,
    }, { allowLocalHttp: true });
    const touched = touchDappPermission420(normalized, nowMs, { allowLocalHttp: true });
    permissions[key] = { ...touched, accounts: [...touched.accounts], sessionScopes: [...touched.sessionScopes] };
    await this.storageArea.set({ [this.storageKey]: permissions });
    return true;
  }

  async revoke(origin) {
    const key = normalizeDappPermissionOrigin420(origin, { allowLocalHttp: true });
    const permissions = await this.readAll();
    const existed = Object.prototype.hasOwnProperty.call(permissions, key);
    delete permissions[key];
    await this.storageArea.set({ [this.storageKey]: permissions });
    return existed;
  }
}

export { normalizeDappPermissionOrigin420 as normalizePermissionOrigin420, STORAGE_KEY as EXTENSION_PERMISSION_STORAGE_KEY_420 };
