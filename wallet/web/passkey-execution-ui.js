import { discoverSmartAccount } from './core/accounts.js';
import { validateRuntimeConfig } from './core/config.js';
import { InjectedProvider420 } from './core/provider.js';
import { parsePasskeyDeviceRecord, passkeyDeviceSummary } from './core/passkey-devices.js';
import {
  confirmPasskeyUserOperation,
  preparePasskeyUserOperation,
  sendPreparedPasskeyUserOperation,
} from './core/passkey-entrypoint-transport.js';

const STORAGE_PREFIX = '420.wallet.passkey.device.v1:';
function storageKey(account) { return `${STORAGE_PREFIX}${String(account || '').toLowerCase()}`; }
function short(value) { return value && value.length > 16 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value || '—'; }

export function derivePasskeyExecutionUiState({ runtimeEnabled = false, deployed = false, deviceSummary = null } = {}) {
  const usable = deviceSummary?.usable === true;
  return {
    usable,
    canSign: Boolean(runtimeEnabled && deployed && usable),
    stateLabel: usable ? 'Ready to sign' : deviceSummary?.status === 'authorization-epoch-stale' ? 'Device stale' : deviceSummary?.status === 'device-revoked' ? 'Device revoked' : 'Unavailable',
  };
}

function createPanel() {
  const section = document.createElement('section');
  section.id = 'passkey-execution-panel';
  section.className = 'panel';
  section.hidden = true;
  section.innerHTML = `
    <div class="section-heading"><div><p class="eyebrow">EntryPoint420 · WebAuthn owner lane</p><h2>Passkey execution</h2></div><span id="passkey-exec-state" class="status-pill" data-state="idle">Unavailable</span></div>
    <div class="account-card permission-grid">
      <div><p class="label">SmartAccount420</p><strong id="passkey-exec-account">—</strong></div>
      <div><p class="label">Device</p><strong id="passkey-exec-device">—</strong></div>
      <div><p class="label">Authorization epoch</p><strong id="passkey-exec-epoch">—</strong></div>
      <div><p class="label">Nonce lane</p><strong>Owner · 0</strong></div>
    </div>
    <div class="form-card">
      <p class="muted">Uses the target, value and calldata currently entered in the Send / Execute panel. A fresh WebAuthn assertion is bound to the canonical EntryPoint420 UserOperation hash, SmartAccount, authorization epoch and owner nonce.</p>
      <div class="button-row"><button id="passkey-exec-submit" class="primary-action" type="button" disabled>Sign & submit with passkey</button><button id="passkey-exec-refresh" type="button">Refresh</button></div>
    </div>
    <p class="security-note"><strong>Fresh assertion required.</strong> After biometric/PIN approval, the wallet re-reads the authorization epoch, selected device binding, owner nonce and canonical UserOperation hash before broadcast. Any drift invalidates the signed operation instead of silently rebuilding it.</p>
    <p id="passkey-exec-status" class="muted" role="status">Connect the wallet and load a qualified passkey device.</p>
  `;
  return section;
}

export async function initPasskeyExecutionUi() {
  const anchor = document.querySelector('#passkey-panel') || document.querySelector('#execution-panel') || document.querySelector('#session-panel');
  if (!anchor || document.querySelector('#passkey-execution-panel')) return;
  const panel = createPanel();
  anchor.after(panel);
  const local = { provider: null, actor: null, config: null, smartAccount: null, device: null, summary: null, busy: false };
  const $ = (selector) => panel.querySelector(selector);
  const globalStatus = document.querySelector('#status');
  const setStatus = (message) => { $('#passkey-exec-status').textContent = message; if (globalStatus) globalStatus.textContent = message; };

  const loadDevice = () => {
    local.device = null;
    local.summary = null;
    if (!local.smartAccount || !globalThis.localStorage) return;
    const raw = globalThis.localStorage.getItem(storageKey(local.smartAccount.smartAccount));
    if (!raw) return;
    local.device = parsePasskeyDeviceRecord(raw);
    local.summary = passkeyDeviceSummary(local.device, {
      smartAccount: local.smartAccount.smartAccount,
      authorizationEpoch: Number(local.smartAccount.authorizationEpoch),
      rpId: local.config.passkey.rpId,
      origin: local.config.passkey.origin,
    });
  };

  const render = () => {
    const model = derivePasskeyExecutionUiState({
      runtimeEnabled: local.config?.features?.passkeys === true,
      deployed: local.smartAccount?.deployed === true,
      deviceSummary: local.summary,
    });
    panel.hidden = local.config?.features?.passkeys !== true;
    $('#passkey-exec-state').textContent = model.stateLabel;
    $('#passkey-exec-state').dataset.state = model.canSign ? 'passed' : 'idle';
    $('#passkey-exec-account').textContent = short(local.smartAccount?.smartAccount);
    $('#passkey-exec-device').textContent = local.summary?.label || '—';
    $('#passkey-exec-epoch').textContent = local.smartAccount?.authorizationEpoch?.toString?.() || '—';
    $('#passkey-exec-submit').disabled = local.busy || !model.canSign;
    $('#passkey-exec-refresh').disabled = local.busy;
  };

  const refresh = async () => {
    if (!globalThis.ethereum) throw new Error('No injected EIP-1193 wallet found');
    local.provider ||= new InjectedProvider420(globalThis.ethereum);
    const accounts = await local.provider.request('eth_accounts');
    local.actor = accounts?.[0]?.toLowerCase() || null;
    if (!local.actor) throw new Error('Connect a wallet to resolve SmartAccount420');
    local.smartAccount = await discoverSmartAccount(local.provider, local.actor, local.config.smartAccount);
    if (!local.smartAccount.deployed) throw new Error('SmartAccount420 must be deployed before passkey execution');
    loadDevice();
    setStatus(local.summary?.usable ? 'Qualified passkey device ready for EntryPoint420 execution.' : 'No usable passkey device is bound to the current authorization epoch.');
    render();
  };

  $('#passkey-exec-refresh').addEventListener('click', async () => {
    try { await refresh(); } catch (error) { setStatus(error.message); render(); }
  });

  $('#passkey-exec-submit').addEventListener('click', async () => {
    if (local.busy) return;
    local.busy = true; render();
    try {
      await refresh();
      if (!local.summary?.usable) throw new Error('selected passkey device is not usable');
      const target = document.querySelector('#execute-target')?.value?.trim();
      const value = document.querySelector('#execute-value')?.value ?? '0';
      const data = document.querySelector('#execute-data')?.value?.trim() || '0x';
      if (!target) throw new Error('enter an execution target in the Send / Execute panel first');
      const review = `Sign this EntryPoint420 operation with ${local.summary.label}?\n\nSmartAccount: ${local.smartAccount.smartAccount}\nTarget: ${target}\nValue: ${value} wei\nAuthorization epoch: ${local.smartAccount.authorizationEpoch}\n\nA fresh WebAuthn assertion will be requested and the operation will be simulated before broadcast.`;
      if (globalThis.confirm && !globalThis.confirm(review)) { setStatus('Passkey execution cancelled before WebAuthn signing.'); return; }
      setStatus('Requesting user-verified passkey assertion and simulating EntryPoint420 operation…');
      const prepared = await preparePasskeyUserOperation(local.provider, local.config, local.smartAccount, local.device, { target, value, data });
      setStatus(`Passkey assertion accepted. Canonical UserOp ${prepared.userOpHash}. Revalidating before broadcast…`);
      const submitted = await sendPreparedPasskeyUserOperation(local.provider, local.config, prepared);
      setStatus(`Passkey UserOperation submitted: ${submitted.txHash}. Waiting for EntryPoint420 confirmation…`);
      const confirmed = await confirmPasskeyUserOperation(local.provider, submitted);
      setStatus(`Passkey execution confirmed. Owner nonce advanced to ${confirmed.nonceAfter}.`);
      await refresh();
    } catch (error) { setStatus(error.message); }
    finally { local.busy = false; render(); }
  });

  try {
    const response = await fetch('./runtime-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime config ${response.status}`);
    local.config = await response.json();
    validateRuntimeConfig(local.config);
    if (local.config?.features?.passkeys === true) await refresh();
    else panel.hidden = true;
  } catch (error) { setStatus(error.message); render(); }
}

if (typeof document !== 'undefined') initPasskeyExecutionUi();
