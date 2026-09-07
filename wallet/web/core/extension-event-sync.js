const DEFAULT_CHANNEL = '420-wallet-provider-v1';

function assertOrigin(value) {
  if (typeof value !== 'string' || !value) throw new TypeError('origin required');
  return new URL(value).origin;
}

function normalizeAccounts(accounts) {
  if (!Array.isArray(accounts)) throw new TypeError('accounts array required');
  return [...new Set(accounts.map((account) => {
    if (typeof account !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(account)) throw new TypeError('valid account address required');
    return account.toLowerCase();
  }))];
}

function eventEnvelope(channel, event, data) {
  return {
    source: '420-wallet-extension',
    channel,
    kind: 'event',
    event,
    data,
  };
}

export class ExtensionProviderEventSync420 {
  constructor({ tabs, permissionStore, channel = DEFAULT_CHANNEL } = {}) {
    if (!tabs || typeof tabs.sendMessage !== 'function') throw new Error('extension tabs API required');
    if (!permissionStore || typeof permissionStore.accountsFor !== 'function') throw new Error('permission store required');
    this.tabs = tabs;
    this.permissionStore = permissionStore;
    this.channel = channel;
    this.tabOrigins = new Map();
    this.chainId = null;
  }

  trackTab(tabId, origin) {
    if (!Number.isInteger(tabId) || tabId < 0) throw new TypeError('valid tabId required');
    this.tabOrigins.set(tabId, assertOrigin(origin));
  }

  untrackTab(tabId) {
    this.tabOrigins.delete(tabId);
  }

  async emitAccountsChanged(origin) {
    const normalizedOrigin = assertOrigin(origin);
    const accounts = normalizeAccounts(await this.permissionStore.accountsFor(normalizedOrigin));
    await this.#broadcastToOrigin(normalizedOrigin, 'accountsChanged', accounts);
    return accounts;
  }

  async emitChainChanged(chainId) {
    if (typeof chainId !== 'string' || !/^0x[0-9a-fA-F]+$/.test(chainId)) throw new TypeError('hex chainId required');
    const normalized = chainId.toLowerCase();
    if (normalized === this.chainId) return false;
    this.chainId = normalized;
    await Promise.all([...this.tabOrigins.keys()].map((tabId) => this.#send(tabId, 'chainChanged', normalized)));
    return true;
  }

  async emitDisconnect(tabId, error = { code: 4900, message: '420 Wallet disconnected' }) {
    if (!Number.isInteger(tabId) || tabId < 0) throw new TypeError('valid tabId required');
    await this.#send(tabId, 'disconnect', error);
  }

  async #broadcastToOrigin(origin, event, data) {
    const targets = [...this.tabOrigins.entries()].filter(([, trackedOrigin]) => trackedOrigin === origin);
    await Promise.all(targets.map(([tabId]) => this.#send(tabId, event, data)));
  }

  async #send(tabId, event, data) {
    try {
      await this.tabs.sendMessage(tabId, eventEnvelope(this.channel, event, data));
    } catch {
      // Closed/navigated tabs are naturally pruned by lifecycle hooks; a stale tab must not break event fanout.
    }
  }
}

export { eventEnvelope as extensionProviderEventEnvelope420 };
