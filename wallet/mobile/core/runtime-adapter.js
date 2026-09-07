const REQUIRED_CAPABILITIES = Object.freeze([
  'rpc',
  'secureStorage',
  'passkeys',
  'openExternalUrl',
]);

function assertFunction(value, label) {
  if (typeof value !== 'function') throw new Error(`${label} capability required`);
}

function normalizeRpcRequest(request) {
  if (!request || typeof request !== 'object') throw new TypeError('RPC request object required');
  if (typeof request.method !== 'string' || !request.method) throw new TypeError('RPC method required');
  if (request.params !== undefined && !Array.isArray(request.params) && (typeof request.params !== 'object' || request.params === null)) {
    throw new TypeError('RPC params must be an array or object');
  }
  return { method: request.method, params: request.params ?? [] };
}

export function createMobileRuntimeAdapter420(capabilities = {}) {
  assertFunction(capabilities.rpc, 'rpc');
  assertFunction(capabilities.secureStorage?.get, 'secureStorage.get');
  assertFunction(capabilities.secureStorage?.set, 'secureStorage.set');
  assertFunction(capabilities.secureStorage?.delete, 'secureStorage.delete');
  assertFunction(capabilities.passkeys?.create, 'passkeys.create');
  assertFunction(capabilities.passkeys?.get, 'passkeys.get');
  assertFunction(capabilities.openExternalUrl, 'openExternalUrl');

  const adapter = {
    platform: typeof capabilities.platform === 'string' && capabilities.platform ? capabilities.platform : 'mobile',
    request(request) {
      const normalized = normalizeRpcRequest(request);
      if (normalized.method === 'personal_sign' || normalized.method === 'eth_sendTransaction') {
        throw new Error('mobile RPC transport cannot provide signing authority');
      }
      return capabilities.rpc(normalized.method, normalized.params);
    },
    secureStorage: Object.freeze({
      get(key) {
        if (typeof key !== 'string' || !key) throw new TypeError('secure storage key required');
        return capabilities.secureStorage.get(key);
      },
      set(key, value) {
        if (typeof key !== 'string' || !key) throw new TypeError('secure storage key required');
        if (value === undefined) throw new TypeError('secure storage value required');
        return capabilities.secureStorage.set(key, value);
      },
      delete(key) {
        if (typeof key !== 'string' || !key) throw new TypeError('secure storage key required');
        return capabilities.secureStorage.delete(key);
      },
    }),
    passkeys: Object.freeze({
      create(options) {
        if (!options || typeof options !== 'object') throw new TypeError('passkey creation options required');
        return capabilities.passkeys.create(options);
      },
      get(options) {
        if (!options || typeof options !== 'object') throw new TypeError('passkey assertion options required');
        return capabilities.passkeys.get(options);
      },
    }),
    openExternalUrl(url) {
      if (typeof url !== 'string' || !/^https:\/\//i.test(url)) throw new TypeError('https URL required');
      return capabilities.openExternalUrl(url);
    },
  };

  if (typeof capabilities.sessionSigner?.signHash === 'function') {
    adapter.sessionSigner = Object.freeze({
      signHash(address, hash) { return capabilities.sessionSigner.signHash(address, hash); },
    });
  }
  if (typeof capabilities.transaction?.submit === 'function') {
    adapter.transaction = Object.freeze({
      submit(transaction) { return capabilities.transaction.submit(transaction); },
    });
  }

  return Object.freeze(adapter);
}

export function createMobileProvider420(runtime) {
  if (!runtime || typeof runtime.request !== 'function') throw new Error('mobile runtime adapter required');
  return Object.freeze({
    request(method, params = []) {
      if (typeof method !== 'string' || !method) throw new TypeError('RPC method required');
      return runtime.request({ method, params });
    },
  });
}

export function inspectMobileCapabilities420(capabilities = {}) {
  return Object.freeze({
    rpc: typeof capabilities.rpc === 'function',
    secureStorage: ['get', 'set', 'delete'].every((key) => typeof capabilities.secureStorage?.[key] === 'function'),
    passkeys: ['create', 'get'].every((key) => typeof capabilities.passkeys?.[key] === 'function'),
    sessionSigner: typeof capabilities.sessionSigner?.signHash === 'function',
    transactionSubmit: typeof capabilities.transaction?.submit === 'function',
    openExternalUrl: typeof capabilities.openExternalUrl === 'function',
    required: [...REQUIRED_CAPABILITIES],
  });
}

export { REQUIRED_CAPABILITIES as MOBILE_REQUIRED_CAPABILITIES_420 };
