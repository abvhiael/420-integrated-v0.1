import { discoverSmartAccount, readDeployedSmartAccountState } from './core/accounts.js';
import { validateRuntimeConfig } from './core/config.js';
import { InjectedProvider420 } from './core/provider.js';
import { recoveryActionAvailability, summarizeRecoveryState } from './core/recovery.js';
import {
  confirmCancelRecovery,
  confirmFinalizeRecovery,
  confirmProposeRecovery,
  confirmSetRecoveryAuthority,
  sendCancelRecovery,
  sendFinalizeRecovery,
  sendProposeRecovery,
  sendSetRecoveryAuthority,
} from './core/recovery-management.js';

function short(value) {
  return value && value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value || '—';
}

export function formatRecoveryCountdown(seconds) {
  if (seconds === null || seconds === undefined) return '—';
  let remaining = BigInt(seconds);
  if (remaining <= 0n) return 'Ready now';
  const days = remaining / 86400n;
  remaining %= 86400n;
  const hours = remaining / 3600n;
  remaining %= 3600n;
  const minutes = remaining / 60n;
  const secs = remaining % 60n;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (minutes || hours || days) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

export function buildRecoveryUiModel(smartAccountState, actor, nowSeconds = Math.floor(Date.now() / 1000)) {
  const availability = recoveryActionAvailability(smartAccountState, actor, nowSeconds);
  const summary = availability.summary;
  return {
    ...availability,
    stateLabel: summary.state === 'ready' ? 'Ready to finalize' : summary.state === 'pending' ? 'Timelock active' : summary.state === 'idle' ? 'Protected' : summary.state === 'disabled' ? 'Recovery disabled' : 'Unavailable',
    countdown: formatRecoveryCountdown(summary.secondsRemaining),
    authority: summary.authority || null,
    pendingOwner: summary.pendingOwner,
  };
}

function createPanel() {
  const section = document.createElement('section');
  section.id = 'recovery-panel';
  section.className = 'panel';
  section.hidden = true;
  section.innerHTML = `
    <div class="section-heading">
      <div><p class="eyebrow">Timelocked account safety</p><h2>Recovery management</h2></div>
      <span id="recovery-state" class="status-pill" data-state="idle">Unavailable</span>
    </div>
    <div class="account-card permission-grid">
      <label><span class="label">SmartAccount420 address</span><input id="recovery-account" type="text" autocomplete="off" placeholder="0x…" /></label>
      <div><p class="label">Recovery authority</p><strong id="recovery-authority">—</strong></div>
      <div><p class="label">Pending owner</p><strong id="recovery-pending-owner">—</strong></div>
      <div><p class="label">Executable at</p><strong id="recovery-executable-at">—</strong></div>
      <div><p class="label">Timelock</p><strong id="recovery-countdown">—</strong></div>
      <div><p class="label">Authorization epoch</p><strong id="recovery-epoch">—</strong></div>
    </div>
    <div class="split-panel">
      <div class="form-card">
        <p class="eyebrow">Owner controls</p>
        <label><span class="label">Recovery authority</span><input id="recovery-new-authority" type="text" autocomplete="off" placeholder="0x…" /></label>
        <div class="button-row"><button id="recovery-set-authority" type="button" disabled>Set authority</button><button id="recovery-cancel" class="danger-button" type="button" disabled>Cancel pending recovery</button></div>
      </div>
      <div class="form-card">
        <p class="eyebrow">Recovery authority controls</p>
        <label><span class="label">Proposed new owner</span><input id="recovery-new-owner" type="text" autocomplete="off" placeholder="0x…" /></label>
        <div class="button-row"><button id="recovery-propose" type="button" disabled>Propose recovery</button><button id="recovery-finalize" class="primary-action" type="button" disabled>Finalize recovery</button></div>
      </div>
    </div>
    <p class="security-note"><strong>Two-day safety delay.</strong> A recovery authority can propose a new owner, but cannot finalize until the canonical SmartAccount420 timelock expires. The current owner can cancel at any time before finalization. Every mutation is simulated before wallet approval and re-verified on-chain after confirmation.</p>
    <p id="recovery-status" class="muted" role="status">Connect a wallet, then select a SmartAccount420.</p>
  `;
  return section;
}

function installRecoveryNavigation(panel) {
  const nav = document.querySelector('.sidebar nav');
  if (!nav || nav.querySelector('[data-scroll-target="#recovery-panel"]')) return;
  const button = document.createElement('button');
  button.className = 'nav-item';
  button.dataset.scrollTarget = '#recovery-panel';
  button.textContent = 'Recovery';
  button.addEventListener('click', () => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const sessionButton = nav.querySelector('[data-scroll-target="#session-panel"]');
  sessionButton?.after(button);
}

export async function initRecoveryUi() {
  const sessionPanel = document.querySelector('#session-panel');
  if (!sessionPanel || document.querySelector('#recovery-panel')) return;
  const panel = createPanel();
  sessionPanel.after(panel);
  installRecoveryNavigation(panel);

  const local = {
    provider: null,
    actor: null,
    config: null,
    smartAccount: null,
    busy: false,
  };
  const $ = (selector) => panel.querySelector(selector);
  const globalStatus = document.querySelector('#status');

  const setStatus = (message) => {
    $('#recovery-status').textContent = message;
    if (globalStatus) globalStatus.textContent = message;
  };

  const render = () => {
    panel.hidden = local.config?.features?.recoveryManagement !== true;
    let model = null;
    if (local.smartAccount) {
      try { model = buildRecoveryUiModel(local.smartAccount, local.actor); }
      catch (error) { setStatus(error.message); }
    }
    const stateBadge = $('#recovery-state');
    stateBadge.textContent = model?.stateLabel || 'Unavailable';
    stateBadge.dataset.state = model?.summary?.state === 'ready' ? 'passed' : model?.summary?.state || 'idle';
    $('#recovery-authority').textContent = short(model?.authority);
    $('#recovery-pending-owner').textContent = short(model?.pendingOwner);
    $('#recovery-executable-at').textContent = model?.summary?.executableAt ? new Date(Number(model.summary.executableAt) * 1000).toLocaleString() : '—';
    $('#recovery-countdown').textContent = model?.countdown || '—';
    $('#recovery-epoch').textContent = local.smartAccount?.authorizationEpoch?.toString?.() || '—';
    $('#recovery-set-authority').disabled = local.busy || !model?.canSetAuthority;
    $('#recovery-propose').disabled = local.busy || !model?.canPropose;
    $('#recovery-cancel').disabled = local.busy || !model?.canCancel;
    $('#recovery-finalize').disabled = local.busy || !model?.canFinalize;
  };

  const readActor = async () => {
    if (!globalThis.ethereum) return null;
    local.provider ||= new InjectedProvider420(globalThis.ethereum);
    const accounts = await local.provider.request('eth_accounts');
    local.actor = accounts?.[0]?.toLowerCase() || null;
    return local.actor;
  };

  const refreshTarget = async ({ allowOwnerDiscovery = true } = {}) => {
    if (!(await readActor())) {
      local.smartAccount = null;
      setStatus('Connect a wallet to manage recovery.');
      render();
      return;
    }
    const typed = $('#recovery-account').value.trim();
    if (typed) {
      local.smartAccount = await readDeployedSmartAccountState(local.provider, typed, { controller: local.actor });
    } else if (allowOwnerDiscovery) {
      const discovered = await discoverSmartAccount(local.provider, local.actor, local.config.smartAccount);
      if (!discovered.deployed) throw new Error('Enter the deployed SmartAccount420 address. Recovery authorities cannot derive another owner’s account from their own address.');
      local.smartAccount = discovered;
      $('#recovery-account').value = discovered.smartAccount;
    } else {
      throw new Error('SmartAccount420 address required');
    }
    setStatus('Canonical recovery state refreshed.');
    render();
  };

  const runMutation = async (label, submit, confirm) => {
    if (local.busy) return;
    local.busy = true;
    render();
    try {
      if (!local.smartAccount) await refreshTarget();
      if (globalThis.confirm && !globalThis.confirm(`${label}? The action will be simulated before your wallet is asked to approve it.`)) return;
      setStatus(`Simulating ${label.toLowerCase()}…`);
      const submitted = await submit();
      setStatus(`${label} submitted: ${submitted.txHash}. Waiting for confirmation…`);
      const confirmed = await confirm(submitted);
      local.smartAccount = confirmed.smartAccount;
      $('#recovery-account').value = local.smartAccount.smartAccount;
      setStatus(`${label} confirmed and canonical recovery state verified.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      local.busy = false;
      render();
    }
  };

  $('#recovery-account').addEventListener('change', async () => {
    try { await refreshTarget({ allowOwnerDiscovery: false }); }
    catch (error) { local.smartAccount = null; setStatus(error.message); render(); }
  });

  $('#recovery-set-authority').addEventListener('click', () => runMutation(
    'Recovery authority update',
    () => sendSetRecoveryAuthority(local.provider, local.actor, local.smartAccount, $('#recovery-new-authority').value.trim()),
    (submitted) => confirmSetRecoveryAuthority(local.provider, submitted.txHash, submitted),
  ));
  $('#recovery-propose').addEventListener('click', () => runMutation(
    'Recovery proposal',
    () => sendProposeRecovery(local.provider, local.actor, local.smartAccount, $('#recovery-new-owner').value.trim()),
    (submitted) => confirmProposeRecovery(local.provider, submitted.txHash, submitted),
  ));
  $('#recovery-cancel').addEventListener('click', () => runMutation(
    'Recovery cancellation',
    () => sendCancelRecovery(local.provider, local.actor, local.smartAccount),
    (submitted) => confirmCancelRecovery(local.provider, submitted.txHash, submitted),
  ));
  $('#recovery-finalize').addEventListener('click', () => runMutation(
    'Recovery finalization',
    () => sendFinalizeRecovery(local.provider, local.actor, local.smartAccount),
    (submitted) => confirmFinalizeRecovery(local.provider, submitted.txHash, submitted),
  ));

  try {
    const response = await fetch('./runtime-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime config ${response.status}`);
    local.config = await response.json();
    validateRuntimeConfig(local.config);
    render();
    if (local.config.features?.recoveryManagement === true && globalThis.ethereum) {
      try { await refreshTarget(); } catch (error) { setStatus(error.message); render(); }
    }
  } catch (error) {
    setStatus(`Recovery UI blocked: ${error.message}`);
  }

  setInterval(render, 1000);
}

if (typeof document !== 'undefined') initRecoveryUi();
