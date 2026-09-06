const DEFAULT_CHANNEL = '420-wallet-provider-v1';
const EVENT_NAMES = new Set(['accountsChanged', 'chainChanged', 'connect', 'disconnect', 'message']);

function providerError(error) {
  const candidate = error && typeof error === 'object' ? error : {};
  return {
    code: Number.isInteger(candidate.code) ? candidate.code : -32603,
    message: typeof candidate.message === 'string' && candidate.message ? candidate.message : '420 Wallet extension request failed',
    ...('data' in candidate ? { data: candidate.data } : {}),
  };
}

function assertRuntime(runtime) {
  if (!runtime || typeof runtime.sendMessage !== 'function') throw new Error('extension runtime.sendMessage required');
}

export function createContentScriptBridge420({
  windowObject = globalThis.window,
  runtime = globalThis.chrome?.runtime ?? globalThis.browser?.runtime,
  channel = DEFAULT_CHANNEL,
} = {}) {
  if (!windowObject || typeof windowObject.addEventListener !== 'function' || typeof windowObject.postMessage !== 'function') {
    throw new Error('browser window required');
  }
  assertRuntime(runtime);
  const origin = windowObject.location?.origin;
  if (typeof origin !== 'string' || !origin || origin === 'null') throw new Error('secure page origin required');

  let destroyed = false;

  const post = (payload) => {
    if (!destroyed) windowObject.postMessage(payload, origin);
  };

  const handlePageMessage = async (event) => {
    if (destroyed || event?.source !== windowObject || event?.origin !== origin) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if (message.source !== '420-wallet-inpage' || message.channel !== channel || message.kind !== 'request') return;
    if (typeof message.id !== 'string' || !message.id || typeof message.method !== 'string' || !message.method) return;

    try {
      const response = await runtime.sendMessage({
        source: '420-wallet-content',
        channel,
        kind: 'rpc',
        origin,
        request: {
          id: message.id,
          method: message.method,
          params: message.params ?? [],
        },
      });

      if (!response || typeof response !== 'object' || response.id !== message.id) {
        const error = new Error('invalid extension RPC response');
        error.code = -32603;
        throw error;
      }

      post({
        source: '420-wallet-extension',
        channel,
        kind: 'response',
        id: message.id,
        ...(response.error ? { error: response.error } : { result: response.result }),
      });
    } catch (error) {
      post({
        source: '420-wallet-extension',
        channel,
        kind: 'response',
        id: message.id,
        error: providerError(error),
      });
    }
  };

  const handleRuntimeMessage = (message) => {
    if (destroyed || !message || typeof message !== 'object') return;
    if (message.source !== '420-wallet-service-worker' || message.channel !== channel) return;
    if (message.kind !== 'event' || !EVENT_NAMES.has(message.event)) return;
    post({
      source: '420-wallet-extension',
      channel,
      kind: 'event',
      event: message.event,
      data: message.data,
    });
  };

  windowObject.addEventListener('message', handlePageMessage);
  runtime.onMessage?.addListener?.(handleRuntimeMessage);

  return Object.freeze({
    origin,
    channel,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      windowObject.removeEventListener?.('message', handlePageMessage);
      runtime.onMessage?.removeListener?.(handleRuntimeMessage);
    },
  });
}
