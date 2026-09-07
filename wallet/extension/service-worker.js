const CHANNEL = '420-wallet-provider-v1';
const PERMISSIONS_KEY = '420-wallet-origin-permissions-v1';
const APPROVALS_KEY = '420-wallet-pending-approvals-v1';
const READ_METHODS = new Set(['eth_chainId','eth_blockNumber','eth_call','eth_estimateGas','eth_getBalance','eth_getCode','eth_getTransactionCount','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getBlockByNumber','eth_getLogs','net_version']);
const APPROVAL_METHODS = new Set(['eth_requestAccounts','eth_sendTransaction','personal_sign','eth_signTypedData_v4']);
const LOCAL_AUTHORITY_METHODS = new Set(['eth_sendTransaction','personal_sign','eth_signTypedData_v4']);
const LOCAL_AUTHORITY_SOURCE = '420-wallet-local-authority';

function normalizeOrigin(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw Object.assign(new Error('unsupported request origin'), { code: 4100 });
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Object.assign(new Error('insecure request origin'), { code: 4100 });
  return url.origin;
}

function serializeError(error) {
  return { code: Number.isInteger(error?.code) ? error.code : -32603, message: error?.message || '420 Wallet request failed', ...('data' in (error ?? {}) ? { data: error.data } : {}) };
}

async function readObject(key) {
  const stored = await chrome.storage.local.get(key);
  const value = stored?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function accountsFor(origin) {
  const permissions = await readObject(PERMISSIONS_KEY);
  return Array.isArray(permissions[origin]?.accounts) ? permissions[origin].accounts : [];
}

async function setAccounts(origin, accounts) {
  const permissions = await readObject(PERMISSIONS_KEY);
  permissions[origin] = { accounts, grantedAt: Date.now() };
  await chrome.storage.local.set({ [PERMISSIONS_KEY]: permissions });
}

async function rpcRequest(method, params) {
  if (LOCAL_AUTHORITY_METHODS.has(method)) {
    throw Object.assign(new Error('sensitive wallet methods cannot use RPC signing or submission authority'), { code: 4100 });
  }
  const config = await readObject('420-wallet-extension-config-v1');
  const rpcUrl = config.rpcUrl;
  if (!rpcUrl) throw Object.assign(new Error('420 Wallet RPC endpoint is not configured'), { code: 4900 });
  const response = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }) });
  if (!response.ok) throw Object.assign(new Error(`rpc http ${response.status}`), { code: 4900 });
  const payload = await response.json();
  if (payload.error) throw Object.assign(new Error(payload.error.message || 'rpc error'), { code: payload.error.code, data: payload.error.data });
  return payload.result;
}

async function executeWithLocalAuthority(request, context) {
  if (!LOCAL_AUTHORITY_METHODS.has(request.method)) {
    throw Object.assign(new Error(`unsupported local authority method: ${request.method}`), { code: 4200 });
  }
  const authorityRequestId = `authority-${context.tabId ?? 'tab'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      source: '420-wallet-service-worker',
      kind: 'authority-request',
      authorityRequestId,
      request,
      context: { origin: context.origin, accounts: context.accounts ?? [], tabId: context.tabId ?? null },
    });
  } catch (error) {
    throw Object.assign(new Error('420 Wallet local signing authority is unavailable'), { code: 4900, data: error?.message });
  }
  if (!response || response.source !== LOCAL_AUTHORITY_SOURCE || response.kind !== 'authority-result' || response.authorityRequestId !== authorityRequestId) {
    throw Object.assign(new Error('420 Wallet local authority returned an invalid response'), { code: 4100 });
  }
  if (response.error) {
    throw Object.assign(new Error(response.error.message || 'local wallet authority rejected the request'), {
      code: Number.isInteger(response.error.code) ? response.error.code : -32603,
      ...('data' in response.error ? { data: response.error.data } : {}),
    });
  }
  if (!('result' in response)) throw Object.assign(new Error('420 Wallet local authority returned no result'), { code: -32603 });
  return response.result;
}

async function createApproval(request, context) {
  const approvals = await readObject(APPROVALS_KEY);
  const approvalId = `${context.tabId ?? 'tab'}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  approvals[approvalId] = { approvalId, request, context, createdAt: Date.now() };
  await chrome.storage.local.set({ [APPROVALS_KEY]: approvals });
  await chrome.windows.create({ url: chrome.runtime.getURL(`popup.html?approval=${encodeURIComponent(approvalId)}`), type: 'popup', width: 420, height: 620 });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(Object.assign(new Error('approval timed out'), { code: 4001 })); }, 120000);
    const listener = (message) => {
      if (!message || message.source !== '420-wallet-popup' || message.kind !== 'approval-result' || message.approvalId !== approvalId) return;
      cleanup();
      if (!message.approved) reject(Object.assign(new Error('User rejected the request'), { code: 4001 }));
      else resolve(message);
    };
    function cleanup() { clearTimeout(timeout); chrome.runtime.onMessage.removeListener(listener); }
    chrome.runtime.onMessage.addListener(listener);
  });
}

async function handleApprovalMethod(request, context) {
  const origin = context.origin;
  if (request.method === 'eth_accounts') return accountsFor(origin);
  if (request.method === 'eth_requestAccounts') {
    const existing = await accountsFor(origin);
    if (existing.length) return existing;
    const config = await readObject('420-wallet-extension-config-v1');
    const available = Array.isArray(config.accounts) ? config.accounts : [];
    if (!available.length) throw Object.assign(new Error('no wallet accounts available'), { code: 4100 });
    const decision = await createApproval({ ...request, availableAccounts: available }, context);
    const selected = Array.isArray(decision.accounts) && decision.accounts.length ? decision.accounts : available;
    await setAccounts(origin, selected);
    chrome.tabs.sendMessage(context.tabId, { source: '420-wallet-service-worker', channel: CHANNEL, kind: 'event', event: 'accountsChanged', data: selected }).catch(() => {});
    return selected;
  }
  const granted = await accountsFor(origin);
  if (!granted.length) throw Object.assign(new Error('origin is not connected to 420 Wallet'), { code: 4100 });
  await createApproval(request, { ...context, accounts: granted });
  return executeWithLocalAuthority(request, { ...context, accounts: granted });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.source !== '420-wallet-content' || message.channel !== CHANNEL || message.kind !== 'rpc') return;
  (async () => {
    try {
      const request = message.request;
      const origin = normalizeOrigin(message.origin);
      const senderOrigin = normalizeOrigin(sender?.url ?? sender?.tab?.url);
      if (origin !== senderOrigin || (sender?.frameId ?? 0) !== 0) throw Object.assign(new Error('request origin is not authorized'), { code: 4100 });
      const context = { origin, tabId: sender?.tab?.id ?? null, frameId: sender?.frameId ?? 0, method: request.method };
      let result;
      if (READ_METHODS.has(request.method)) result = await rpcRequest(request.method, request.params ?? []);
      else if (request.method === 'eth_accounts' || APPROVAL_METHODS.has(request.method)) result = await handleApprovalMethod(request, context);
      else throw Object.assign(new Error(`unsupported provider method: ${request.method}`), { code: 4200 });
      sendResponse({ id: request.id, result });
    } catch (error) {
      sendResponse({ id: message?.request?.id ?? null, error: serializeError(error) });
    }
  })();
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const config = await readObject('420-wallet-extension-config-v1');
  if (!Object.keys(config).length) await chrome.storage.local.set({ '420-wallet-extension-config-v1': { rpcUrl: null, accounts: [] } });
});
