import { createExtensionLocalAuthority420 } from './core/extension-local-authority.js';

const AUTHORITY_KEY = '420-wallet-pending-authority-v1';
const BINDINGS_KEY = '420-wallet-passkey-bindings-v1';
const CONFIG_KEY = '420-wallet-extension-config-v1';
const LOCAL_AUTHORITY_SOURCE = '420-wallet-local-authority';
const authorityRequestId = new URLSearchParams(location.search).get('request');
const $ = (id) => document.getElementById(id);

function serializeError(error) {
  return {
    code: Number.isInteger(error?.code) ? error.code : -32603,
    message: error?.message || '420 Wallet local authority failed',
    ...('data' in (error ?? {}) ? { data: error.data } : {}),
  };
}

function provider() {
  return {
    async request(methodOrRequest, maybeParams) {
      const request = typeof methodOrRequest === 'string'
        ? { method: methodOrRequest, params: maybeParams ?? [] }
        : methodOrRequest;
      const response = await chrome.runtime.sendMessage({
        source: '420-wallet-authority-ui',
        kind: 'authority-rpc',
        request,
      });
      if (!response) throw new Error('extension authority RPC bridge returned no response');
      if (response.error) throw Object.assign(new Error(response.error.message), response.error);
      return response.result;
    },
  };
}

async function readState() {
  const stored = await chrome.storage.local.get([AUTHORITY_KEY, BINDINGS_KEY, CONFIG_KEY]);
  const pending = stored?.[AUTHORITY_KEY]?.[authorityRequestId];
  if (!pending) throw Object.assign(new Error('local authority request is no longer available'), { code: 4001 });
  return {
    pending,
    bindings: stored?.[BINDINGS_KEY] ?? {},
    config: stored?.[CONFIG_KEY] ?? {},
  };
}

async function complete(payload) {
  await chrome.runtime.sendMessage({
    source: LOCAL_AUTHORITY_SOURCE,
    kind: 'authority-result',
    authorityRequestId,
    ...payload,
  });
  window.close();
}

async function run() {
  if (!authorityRequestId) throw new Error('authority request ID required');
  const { pending, bindings, config } = await readState();
  $('request').hidden = false;
  $('kind').textContent = pending.request.method;
  $('origin').textContent = pending.context.origin;
  $('details').textContent = pending.request.method === 'eth_sendTransaction'
    ? JSON.stringify(pending.request.params?.[0] ?? {}, null, 2)
    : 'This request requires a configured local signing authority.';

  const execute = createExtensionLocalAuthority420({
    provider: provider(),
    navigatorLike: navigator,
    smartAccountConfig: config.smartAccountConfig,
    loadPasskeyBinding: async ({ account, smartAccount }) => {
      return bindings[smartAccount.toLowerCase()] ?? bindings[account.toLowerCase()] ?? null;
    },
    persistPasskeyBinding: async (binding, { account }) => {
      const current = await chrome.storage.local.get(BINDINGS_KEY);
      const next = current?.[BINDINGS_KEY] ?? {};
      next[binding.smartAccount.toLowerCase()] = binding;
      next[account.toLowerCase()] = binding;
      await chrome.storage.local.set({ [BINDINGS_KEY]: next });
    },
  });

  $('status').textContent = pending.request.method === 'eth_sendTransaction'
    ? 'Confirm this SmartAccount420 transaction with your passkey.'
    : 'Checking local signing authority…';
  const result = await execute(pending.request, pending.context);
  await complete({ result });
}

run().catch(async (error) => {
  $('status').textContent = error?.message || 'Local wallet authority failed.';
  try { await complete({ error: serializeError(error) }); } catch {}
});
