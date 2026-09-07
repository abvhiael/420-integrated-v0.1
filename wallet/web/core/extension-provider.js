const DEFAULT_CHANNEL = '420-wallet-provider-v1';
const EVENT_NAMES = new Set(['accountsChanged', 'chainChanged', 'connect', 'disconnect', 'message']);

function assertRpcRequest(request) {
  if (!request || typeof request !== 'object') throw new TypeError('EIP-1193 request object required');
  if (typeof request.method !== 'string' || !request.method.trim()) throw new TypeError('EIP-1193 method required');
  if (request.params !== undefined && !Array.isArray(request.params) && (typeof request.params !== 'object' || request.params === null)) {
    throw new TypeError('EIP-1193 params must be an array or object');
  }
}

function normalizeError(error) {
  const candidate = error && typeof error === 'object' ? error : {};
  const normalized = new Error(typeof candidate.message === 'string' && candidate.message ? candidate.message : '420 Wallet provider request failed');
  if (Number.isInteger(candidate.code)) normalized.code = candidate.code;
  if ('data' in candidate) normalized.data = candidate.data;
  return normalized;
}

export class ExtensionProvider420 {
  constructor({
    windowObject = globalThis.window,
    channel = DEFAULT_CHANNEL,
    timeoutMs = 30_000,
  } = {}) {
    if (!windowObject || typeof windowObject.postMessage !== 'function' || typeof windowObject.addEventListener !== 'function') {
      throw new Error('browser window required');
    }
    if (typeof channel !== 'string' || !channel) throw new TypeError('provider channel required');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('positive timeoutMs required');

    const origin = windowObject.location?.origin;
    if (typeof origin !== 'string' || !origin || origin === 'null') throw new Error('secure page origin required');

    this.windowObject = windowObject;
    this.origin = origin;
    this.channel = channel;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.destroyed = false;
    this.is420Wallet = true;

    this.handleMessage = this.handleMessage.bind(this);
    this.windowObject.addEventListener('message', this.handleMessage);
  }

  request(request) {
    if (this.destroyed) return Promise.reject(new Error('420 Wallet provider is destroyed'));
    try {
      assertRpcRequest(request);
    } catch (error) {
      return Promise.reject(error);
    }

    const id = `420-${this.nextId++}`;
    const payload = {
      source: '420-wallet-inpage',
      channel: this.channel,
      kind: 'request',
      id,
      method: request.method,
      params: request.params ?? [],
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.pending.delete(id)) return;
        const error = new Error(`420 Wallet provider request timed out: ${request.method}`);
        error.code = 4900;
        reject(error);
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.windowObject.postMessage(payload, this.origin);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  on(eventName, listener) {
    if (!EVENT_NAMES.has(eventName)) throw new TypeError(`unsupported provider event: ${eventName}`);
    if (typeof listener !== 'function') throw new TypeError('provider event listener must be a function');
    const listeners = this.listeners.get(eventName) ?? new Set();
    listeners.add(listener);
    this.listeners.set(eventName, listeners);
    return this;
  }

  removeListener(eventName, listener) {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return this;
    listeners.delete(listener);
    if (listeners.size === 0) this.listeners.delete(eventName);
    return this;
  }

  handleMessage(event) {
    if (this.destroyed) return;
    if (event?.source !== this.windowObject || event?.origin !== this.origin) return;

    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.source !== '420-wallet-extension' || message.channel !== this.channel) return;

    if (message.kind === 'response') {
      if (typeof message.id !== 'string') return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      if (message.error) pending.reject(normalizeError(message.error));
      else pending.resolve(message.result);
      return;
    }

    if (message.kind === 'event' && EVENT_NAMES.has(message.event)) {
      for (const listener of this.listeners.get(message.event) ?? []) {
        try {
          listener(message.data);
        } catch {
          // Consumer event handlers must never break the provider transport.
        }
      }
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.windowObject.removeEventListener?.('message', this.handleMessage);
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      const error = new Error('420 Wallet provider disconnected');
      error.code = 4900;
      pending.reject(error);
    }
    this.pending.clear();
    this.listeners.clear();
  }
}

export function installExtensionProvider420(options = {}) {
  const windowObject = options.windowObject ?? globalThis.window;
  if (!windowObject) throw new Error('browser window required');
  if (windowObject.ethereum?.is420Wallet) return windowObject.ethereum;
  const provider = new ExtensionProvider420({ ...options, windowObject });
  Object.defineProperty(windowObject, 'ethereum', {
    configurable: true,
    enumerable: true,
    writable: false,
    value: provider,
  });
  return provider;
}
