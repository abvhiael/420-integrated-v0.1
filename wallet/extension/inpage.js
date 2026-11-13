(() => {
  'use strict';
  const CHANNEL = '420-wallet-provider-v1';
  const EVENTS = new Set(['accountsChanged', 'chainChanged', 'connect', 'disconnect', 'message']);
  const pending = new Map();
  const listeners = new Map();
  const info = Object.freeze({
    uuid: '42000000-0000-4000-8000-000000000420',
    name: '420 Wallet',
    icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#123b2c"/><text x="32" y="42" text-anchor="middle" fill="#e7cf7a" font-family="sans-serif" font-weight="bold" font-size="23">420</text></svg>'),
    rdns: 'integrated.420.wallet'
  });
  let nextId = 0;
  let connected = false;
  let currentChain = null;
  let currentAccounts = [];

  function emit(eventName, value) {
    for (const listener of [...(listeners.get(eventName) || [])]) {
      try { listener(value); } catch { /* Consumers cannot interrupt provider state. */ }
    }
  }
  function request({ method, params = [] } = {}) {
    if (typeof method !== 'string' || !method.trim()) return Promise.reject(Object.assign(new Error('EIP-1193 method required'), { code: -32600 }));
    if (!Array.isArray(params) && (!params || typeof params !== 'object')) return Promise.reject(Object.assign(new Error('invalid EIP-1193 params'), { code: -32602 }));
    const id = '420-' + (++nextId);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(Object.assign(new Error('420 Wallet request timed out: ' + method), { code: 4900 }));
      }, 30000);
      pending.set(id, { resolve, reject, timeout, method });
      window.postMessage({ source: '420-wallet-inpage', channel: CHANNEL, kind: 'request', id, method, params }, window.location.origin);
    });
  }
  function on(eventName, listener) {
    if (!EVENTS.has(eventName) || typeof listener !== 'function') throw new TypeError('unsupported provider event');
    const group = listeners.get(eventName) || new Set();
    group.add(listener);
    listeners.set(eventName, group);
    return provider;
  }
  function removeListener(eventName, listener) {
    listeners.get(eventName)?.delete(listener);
    return provider;
  }
  function removeAllListeners(eventName) {
    if (eventName === undefined) listeners.clear();
    else listeners.delete(eventName);
    return provider;
  }
  const provider = Object.freeze({
    request, on, addListener: on, removeListener, off: removeListener, removeAllListeners,
    is420Wallet: true, isConnected: () => connected,
    get selectedAddress() { return currentAccounts[0] || null; },
    get chainId() { return currentChain; }
  });
  const detail = Object.freeze({ info, provider });
  function announce() {
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail }));
  }
  window.addEventListener('eip6963:requestProvider', announce);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== '420-wallet-extension' || message.channel !== CHANNEL) return;
    if (message.kind === 'response') {
      const entry = pending.get(message.id);
      if (!entry) return;
      clearTimeout(entry.timeout);
      pending.delete(message.id);
      if (message.error) {
        const error = new Error(message.error.message || '420 Wallet request failed');
        if (Number.isInteger(message.error.code)) error.code = message.error.code;
        if ('data' in message.error) error.data = message.error.data;
        if (error.code === 4900 && connected) {
          connected = false;
          currentAccounts = [];
          emit('disconnect', { code: 4900, message: error.message });
        }
        entry.reject(error);
      } else {
        if (entry.method === 'eth_chainId' && typeof message.result === 'string' &&
            /^0x[0-9a-fA-F]+$/.test(message.result)) {
          const first = !connected;
          connected = true;
          currentChain = message.result;
          if (first) emit('connect', { chainId: currentChain });
        }
        entry.resolve(message.result);
      }
      return;
    }
    if (message.kind !== 'event' || !EVENTS.has(message.event)) return;
    if (message.event === 'accountsChanged') {
      if (!Array.isArray(message.data)) return;
      currentAccounts = message.data.filter(a => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a));
    } else if (message.event === 'chainChanged') {
      if (typeof message.data !== 'string' || !/^0x[0-9a-fA-F]+$/.test(message.data)) return;
      currentChain = message.data;
    } else if (message.event === 'connect') {
      connected = true;
      if (typeof message.data?.chainId === 'string') currentChain = message.data.chainId;
    } else if (message.event === 'disconnect') {
      connected = false;
      currentAccounts = [];
    }
    emit(message.event, message.data);
  });
  // Never overwrite MetaMask or any other installed provider.
  if (!window.ethereum) {
    Object.defineProperty(window, 'ethereum', {
      configurable: true, enumerable: true, value: provider
    });
  }
  // EIP-6963 is advertised regardless of window.ethereum ownership and
  // re-announced for late-mounted dApps after every requestProvider event.
  announce();
  // The isolated content-script bridge is already installed before this script runs.
  // Rehydrate public state after navigation/restart without requesting account approval.
  Promise.allSettled([request({ method: 'eth_chainId' }), request({ method: 'eth_accounts' })])
    .then(results => {
      const [chain, accounts] = results;
      if (chain.status === 'fulfilled' && /^0x[0-9a-fA-F]+$/.test(chain.value)) {
        const first = !connected;
        connected = true;
        currentChain = chain.value;
        if (first) emit('connect', { chainId: currentChain });
      }
      if (accounts.status === 'fulfilled' && Array.isArray(accounts.value)) {
        const next = accounts.value.filter(a => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a));
        if (JSON.stringify(next) !== JSON.stringify(currentAccounts)) {
          currentAccounts = next;
          emit('accountsChanged', next);
        }
      }
    });
})();
