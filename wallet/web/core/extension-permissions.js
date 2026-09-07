const STORAGE_KEY = '420-wallet-origin-permissions-v1';

function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value) throw new TypeError('origin required');
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new TypeError('unsupported origin');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new TypeError('insecure origin');
  return url.origin;
}

function normalizeAccounts(accounts) {
  if (!Array.isArray(accounts)) throw new TypeError('accounts array required');
  const normalized = [...new Set(accounts.map((account) => {
    if (typeof account !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(account)) throw new TypeError('valid account address required');
    return account.toLowerCase();
  }))];
  return Object.freeze(normalized);
}

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

  async accountsFor(origin) {
    const key = normalizeOrigin(origin);
    const permissions = await this.readAll();
    const accounts = permissions[key]?.accounts;
    if (!Array.isArray(accounts)) return [];
    try {
      return [...normalizeAccounts(accounts)];
    } catch {
      return [];
    }
  }

  async grant(origin, accounts) {
    const key = normalizeOrigin(origin);
    const normalizedAccounts = normalizeAccounts(accounts);
    const permissions = await this.readAll();
    permissions[key] = {
      accounts: [...normalizedAccounts],
      grantedAt: Date.now(),
    };
    await this.storageArea.set({ [this.storageKey]: permissions });
    return [...normalizedAccounts];
  }

  async revoke(origin) {
    const key = normalizeOrigin(origin);
    const permissions = await this.readAll();
    const existed = Object.prototype.hasOwnProperty.call(permissions, key);
    delete permissions[key];
    await this.storageArea.set({ [this.storageKey]: permissions });
    return existed;
  }
}

export { normalizeOrigin as normalizePermissionOrigin420, STORAGE_KEY as EXTENSION_PERMISSION_STORAGE_KEY_420 };
