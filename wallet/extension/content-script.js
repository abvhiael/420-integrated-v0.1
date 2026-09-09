(() => {
  const CHANNEL = '420-wallet-provider-v1';
  const origin = window.location.origin;
  if (!origin || origin === 'null') return;

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inpage.js');
  script.async = false;
  (document.documentElement || document.head).appendChild(script);
  script.remove();

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== origin) return;
    const message = event.data;
    if (!message || message.source !== '420-wallet-inpage' || message.channel !== CHANNEL || message.kind !== 'request') return;
    try {
      const response = await chrome.runtime.sendMessage({
        source: '420-wallet-content',
        channel: CHANNEL,
        kind: 'rpc',
        origin,
        request: { id: message.id, method: message.method, params: message.params ?? [] },
      });
      window.postMessage({
        source: '420-wallet-extension',
        channel: CHANNEL,
        kind: 'response',
        id: message.id,
        ...(response?.error ? { error: response.error } : { result: response?.result }),
      }, origin);
    } catch (error) {
      window.postMessage({
        source: '420-wallet-extension',
        channel: CHANNEL,
        kind: 'response',
        id: message.id,
        error: { code: Number.isInteger(error?.code) ? error.code : -32603, message: error?.message || '420 Wallet extension request failed' },
      }, origin);
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.source !== '420-wallet-service-worker' || message.channel !== CHANNEL || message.kind !== 'event') return;
    window.postMessage({ source: '420-wallet-extension', channel: CHANNEL, kind: 'event', event: message.event, data: message.data }, origin);
  });
})();
