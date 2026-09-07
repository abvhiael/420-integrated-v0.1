(() => {
  const CHANNEL = '420-wallet-provider-v1';
  const EVENTS = new Set(['accountsChanged', 'chainChanged', 'connect', 'disconnect', 'message']);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  function request({ method, params = [] } = {}) {
    if (typeof method !== 'string' || !method) return Promise.reject(new TypeError('EIP-1193 method required'));
    const id = `420-${nextId++}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        const error = new Error(`420 Wallet provider request timed out: ${method}`);
        error.code = 4900;
        reject(error);
      }, 30000);
      pending.set(id, { resolve, reject, timeout });
      window.postMessage({ source: '420-wallet-inpage', channel: CHANNEL, kind: 'request', id, method, params }, window.location.origin);
    });
  }

  function on(eventName, listener) {
    if (!EVENTS.has(eventName) || typeof listener !== 'function') throw new TypeError('unsupported provider event');
    const set = listeners.get(eventName) ?? new Set();
    set.add(listener);
    listeners.set(eventName, set);
    return provider;
  }

  function removeListener(eventName, listener) {
    listeners.get(eventName)?.delete(listener);
    return provider;
  }

  const provider = Object.freeze({ request, on, removeListener, is420Wallet: true });

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== '420-wallet-extension' || message.channel !== CHANNEL) return;
    if (message.kind === 'response') {
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timeout);
      pending.delete(message.id);
      if (message.error) {
        const error = new Error(message.error.message || '420 Wallet request failed');
        if (Number.isInteger(message.error.code)) error.code = message.error.code;
        if ('data' in message.error) error.data = message.error.data;
        item.reject(error);
      } else item.resolve(message.result);
      return;
    }
    if (message.kind === 'event' && EVENTS.has(message.event)) {
      for (const listener of listeners.get(message.event) ?? []) {
        try { listener(message.data); } catch {}
      }
    }
  });

  if (!window.ethereum || window.ethereum.is420Wallet) {
    Object.defineProperty(window, 'ethereum', { configurable: true, enumerable: true, value: provider });
  } else {
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
      info: { uuid: '42000000-0000-4000-8000-000000000420', name: '420 Wallet', icon: '', rdns: 'wallet.420.integrated' },
      provider,
    } }));
  }
})();
