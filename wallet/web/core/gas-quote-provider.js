function assert420(condition, message) {
  if (!condition) throw new Error(message);
}

function endpoint420(value) {
  assert420(typeof value === 'string' && value.length > 0, '420Gas quote endpoint is required');
  let url;
  try { url = new URL(value); } catch { throw new Error('420Gas quote endpoint must be a valid URL'); }
  assert420(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)), '420Gas quote endpoint must use HTTPS outside localhost');
  return url.toString();
}

export function createGasQuoteHttpProvider420({ endpoint, fetchImpl = globalThis.fetch, credentialProvider } = {}) {
  const url = endpoint420(endpoint);
  assert420(typeof fetchImpl === 'function', '420Gas quote provider requires fetch');
  if (credentialProvider != null) assert420(typeof credentialProvider === 'function', '420Gas credential provider must be a function');

  return Object.freeze({
    async discoverQuote(request) {
      let credential = null;
      if (credentialProvider) credential = await credentialProvider({ audience: '420gas', scope: 'gas:quote' });
      if (credentialProvider) assert420(typeof credential === 'string' && credential.length > 0, '420Gas credential provider returned no credential');
      const headers = { 'content-type': 'application/json', 'accept': 'application/json' };
      if (credential) headers.authorization = `Bearer ${credential}`;
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(request),
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
        });
      } catch (error) {
        throw new Error(`420Gas quote service unavailable: ${error?.message || 'network request failed'}`);
      }
      if (response.status === 204 || response.status === 404) return null;
      if (!response.ok) throw new Error(`420Gas quote service rejected request (${response.status})`);
      let quote;
      try { quote = await response.json(); } catch { throw new Error('420Gas quote service returned invalid JSON'); }
      assert420(quote && typeof quote === 'object' && !Array.isArray(quote), '420Gas quote service returned an invalid quote');
      return quote;
    },
  });
}

export function gasQuoteProviderFromRuntime420(config, options = {}) {
  const gasQuote = config?.gasQuote;
  if (!gasQuote || gasQuote.enabled !== true) return null;
  return createGasQuoteHttpProvider420({
    endpoint: gasQuote.endpoint,
    fetchImpl: options.fetchImpl,
    credentialProvider: options.credentialProvider,
  });
}
