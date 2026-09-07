const APPROVALS_KEY = '420-wallet-pending-approvals-v1';
const params = new URLSearchParams(location.search);
const approvalId = params.get('approval');
const $ = (id) => document.getElementById(id);

function prettyRequest(request) {
  if (!request) return '';
  if (request.method === 'eth_requestAccounts') return 'Connect this site to 420 Wallet.';
  if (request.method === 'eth_sendTransaction') return JSON.stringify(request.params?.[0] ?? {}, null, 2);
  if (request.method === 'personal_sign') return `Personal signature request\n${String(request.params?.[0] ?? '')}`;
  if (request.method === 'eth_signTypedData_v4') return `Typed data signature request\n${String(request.params?.[1] ?? '')}`;
  return JSON.stringify(request.params ?? [], null, 2);
}

async function loadApproval() {
  if (!approvalId) {
    $('status').textContent = '420 Wallet is ready. No approval request is pending.';
    return;
  }
  const stored = await chrome.storage.local.get(APPROVALS_KEY);
  const approvals = stored?.[APPROVALS_KEY] ?? {};
  const approval = approvals[approvalId];
  if (!approval) {
    $('status').textContent = 'This approval request is no longer available.';
    return;
  }

  $('status').textContent = 'Review this request carefully before approving.';
  $('request').hidden = false;
  $('actions').hidden = false;
  $('kind').textContent = approval.request.method;
  $('origin').textContent = approval.context.origin;
  $('details').textContent = prettyRequest(approval.request);

  const available = approval.request.availableAccounts;
  if (Array.isArray(available) && available.length) {
    $('account-picker').hidden = false;
    $('account').replaceChildren(...available.map((account) => {
      const option = document.createElement('option');
      option.value = account;
      option.textContent = account;
      return option;
    }));
  }

  async function finish(approved) {
    $('approve').disabled = true;
    $('reject').disabled = true;
    const current = await chrome.storage.local.get(APPROVALS_KEY);
    const next = current?.[APPROVALS_KEY] ?? {};
    delete next[approvalId];
    await chrome.storage.local.set({ [APPROVALS_KEY]: next });
    await chrome.runtime.sendMessage({
      source: '420-wallet-popup',
      kind: 'approval-result',
      approvalId,
      approved,
      ...(approved && !$('account-picker').hidden ? { accounts: [$('account').value] } : {}),
    });
    window.close();
  }

  $('approve').addEventListener('click', () => finish(true));
  $('reject').addEventListener('click', () => finish(false));
}

loadApproval().catch((error) => {
  $('status').textContent = error?.message || 'Unable to load approval request.';
});
