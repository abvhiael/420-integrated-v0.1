export class JsonRpcProvider420 {
  constructor({ rpcUrl, fetchImpl = globalThis.fetch } = {}) {
    if (!rpcUrl) throw new Error('rpcUrl required');
    if (typeof fetchImpl !== 'function') throw new Error('fetch implementation required');
    this.rpcUrl = rpcUrl;
    this.fetchImpl = fetchImpl;
    this.nextId = 1;
  }

  async request(method, params = []) {
    if (typeof method !== 'string' || !method) throw new TypeError('method required');
    const response = await this.fetchImpl(this.rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: this.nextId++, method, params }),
    });
    if (!response.ok) throw new Error(`rpc http ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || 'rpc error');
    return payload.result;
  }
}

export class InjectedProvider420 {
  constructor(provider) {
    if (!provider || typeof provider.request !== 'function') throw new Error('EIP-1193 provider required');
    this.provider = provider;
  }

  request(method, params = []) {
    return this.provider.request({ method, params });
  }

  async requestAccounts() {
    return this.request('eth_requestAccounts');
  }

  async chainId() {
    return this.request('eth_chainId');
  }
}
