import { discoverSmartAccount } from './core/accounts.js';
import { validateRuntimeConfig } from './core/config.js';
import { InjectedProvider420 } from './core/provider.js';
import { buildPasskeyChallenge, bytesToBase64Url, normalizeRpConfiguration } from './core/passkeys.js';
import { registerPasskeyForEnrollment } from './core/passkey-enrollment.js';
import {
  buildPasskeyEnrollmentReview,
  confirmPasskeyManagementTransaction,
  finalizePasskeyEnrollmentDevice,
  finalizePasskeyReplacementDevice,
  finalizePasskeyRevocationDevice,
  readPasskeyManagementState,
  sendPasskeyEnrollment,
  sendPasskeyRevocation,
} from './core/passkey-management.js';
import { parsePasskeyDeviceRecord, passkeyDeviceSummary, serializePasskeyDeviceRecord } from './core/passkey-devices.js';

const STORAGE_PREFIX = '420.wallet.passkey.device.v1:';

function short(value) { return value && value.length > 16 ? `${value.slice(0, 9)}…${value.slice(-7)}` : value || '—'; }
function storageKey(account) { return `${STORAGE_PREFIX}${String(account || '').toLowerCase()}`; }

export function derivePasskeyUiState({ runtimeEnabled = false, owner = false, verifierConfigured = false, deviceSummary = null } = {}) {
  const deviceStatus = deviceSummary?.status || 'none';
  const hasDevice = Boolean(deviceSummary?.credentialId);
  const usable = deviceSummary?.usable === true;
  return {
    deviceStatus,
    hasDevice,
    usable,
    canEnroll: Boolean(runtimeEnabled && owner && verifierConfigured),
    canRevoke: Boolean(owner && verifierConfigured && hasDevice && deviceStatus !== 'device-revoked'),
    enrollmentLabel: hasDevice && deviceStatus !== 'device-revoked' ? 'Replace passkey' : 'Add passkey',
    stateLabel: usable ? 'Ready' : deviceStatus === 'authorization-epoch-stale' ? 'Stale' : deviceStatus === 'device-revoked' ? 'Revoked' : hasDevice ? 'Unavailable' : 'Not enrolled',
  };
}

function createPanel() {
  const section = document.createElement('section');
  section.id = 'passkey-panel';
  section.className = 'panel';
  section.hidden = true;
  section.innerHTML = `
    <div class="section-heading"><div><p class="eyebrow">WebAuthn · owner authority</p><h2>Passkeys & devices</h2></div><span id="passkey-state" class="status-pill" data-state="idle">Unavailable</span></div>
    <div class="account-card permission-grid">
      <div><p class="label">SmartAccount420</p><strong id="passkey-account">—</strong></div>
      <div><p class="label">Authorization epoch</p><strong id="passkey-epoch">—</strong></div>
      <div><p class="label">P-256 verifier</p><strong id="passkey-verifier">—</strong></div>
      <div><p class="label">Device</p><strong id="passkey-device-label">—</strong></div>
      <div><p class="label">Credential</p><strong id="passkey-credential">—</strong></div>
      <div><p class="label">RP / origin</p><strong id="passkey-rp">—</strong></div>
    </div>
    <div class="form-card">
      <label><span class="label">Device label</span><input id="passkey-label" type="text" value="This device" maxlength="80" autocomplete="off" /></label>
      <div class="button-row"><button id="passkey-enroll" class="primary-action" type="button" disabled>Add passkey</button><button id="passkey-revoke" class="danger-button" type="button" disabled>Revoke passkey</button><button id="passkey-refresh" type="button">Refresh</button></div>
    </div>
    <p class="security-note"><strong>Owner-confirmed authority.</strong> Registration is reviewed against the current SmartAccount, authorization epoch, relying-party identity and browser origin. The transaction is simulated before wallet approval and the epoch must advance after confirmation. Only public credential metadata is stored locally; no private key or authenticator secret is persisted.</p>
    <p id="passkey-runtime-note" class="muted"></p>
    <p id="passkey-status" class="muted" role="status">Connect the owner wallet to inspect passkey state.</p>
  `;
  return section;
}

function installNavigation(panel) {
  const nav = document.querySelector('.sidebar nav');
  if (!nav || nav.querySelector('[data-scroll-target="#passkey-panel"]')) return;
  const button = document.createElement('button');
  button.className = 'nav-item';
  button.dataset.scrollTarget = '#passkey-panel';
  button.textContent = 'Passkeys';
  button.addEventListener('click', () => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const recovery = nav.querySelector('[data-scroll-target="#recovery-panel"]');
  (recovery || nav.querySelector('[data-scroll-target="#session-panel"]'))?.after(button);
}

export async function initPasskeyManagementUi() {
  const anchor = document.querySelector('#session-panel');
  if (!anchor || document.querySelector('#passkey-panel')) return;
  const panel = createPanel();
  const recovery = document.querySelector('#recovery-panel');
  (recovery || anchor).after(panel);
  installNavigation(panel);

  const local = { provider: null, actor: null, config: null, smartAccount: null, chainState: null, device: null, busy: false };
  const $ = (selector) => panel.querySelector(selector);
  const globalStatus = document.querySelector('#status');
  const setStatus = (message) => { $('#passkey-status').textContent = message; if (globalStatus) globalStatus.textContent = message; };

  const rpConfig = () => normalizeRpConfiguration({
    origin: local.config?.passkey?.origin || globalThis.location?.origin,
    rpId: local.config?.passkey?.rpId || globalThis.location?.hostname,
    production: local.config?.passkey?.production === true,
  });

  const loadDevice = () => {
    local.device = null;
    if (!local.smartAccount || !globalThis.localStorage) return;
    const serialized = globalThis.localStorage.getItem(storageKey(local.smartAccount.smartAccount));
    if (!serialized) return;
    try { local.device = parsePasskeyDeviceRecord(serialized); }
    catch { globalThis.localStorage.removeItem(storageKey(local.smartAccount.smartAccount)); }
  };
  const saveDevice = (record) => {
    local.device = record;
    if (globalThis.localStorage && local.smartAccount) globalThis.localStorage.setItem(storageKey(local.smartAccount.smartAccount), serializePasskeyDeviceRecord(record));
  };

  const currentSummary = () => {
    if (!local.device || !local.smartAccount) return null;
    const rp = rpConfig();
    return passkeyDeviceSummary(local.device, {
      smartAccount: local.smartAccount.smartAccount,
      authorizationEpoch: Number(local.chainState?.authorizationEpoch ?? local.smartAccount.authorizationEpoch),
      rpId: rp.rpId,
      origin: rp.origin,
    });
  };

  const render = () => {
    const managementVisible = local.config?.features?.passkeyDeviceManagement === true;
    panel.hidden = !managementVisible;
    if (!managementVisible) return;
    let summary = null;
    try { summary = currentSummary(); } catch {}
    const model = derivePasskeyUiState({
      runtimeEnabled: local.config?.features?.passkeys === true,
      owner: local.smartAccount?.controllerIsOwner === true,
      verifierConfigured: local.chainState?.verifierConfigured === true,
      deviceSummary: summary,
    });
    $('#passkey-state').textContent = model.stateLabel;
    $('#passkey-state').dataset.state = model.usable ? 'passed' : model.deviceStatus === 'authorization-epoch-stale' ? 'pending' : 'idle';
    $('#passkey-account').textContent = short(local.smartAccount?.smartAccount);
    $('#passkey-epoch').textContent = local.chainState?.authorizationEpoch?.toString?.() || '—';
    $('#passkey-verifier').textContent = local.chainState?.verifierConfigured ? short(local.chainState.verifier) : 'Not configured';
    $('#passkey-device-label').textContent = summary?.label || '—';
    $('#passkey-credential').textContent = short(summary?.credentialId);
    $('#passkey-rp').textContent = local.device ? `${local.device.rpId} · ${local.device.origin}` : '—';
    $('#passkey-enroll').disabled = local.busy || !model.canEnroll;
    $('#passkey-enroll').textContent = model.enrollmentLabel;
    $('#passkey-revoke').disabled = local.busy || !model.canRevoke;
    $('#passkey-refresh').disabled = local.busy;
    $('#passkey-runtime-note').textContent = local.config?.features?.passkeys === true
      ? 'Passkey authority is enabled by runtime policy for this deployment.'
      : 'Passkey enrollment remains runtime-disabled until production RP/origin qualification is complete. Existing credentials can still be inspected or revoked.';
  };

  const refresh = async () => {
    if (!globalThis.ethereum) { setStatus('No injected EIP-1193 wallet found.'); render(); return; }
    local.provider ||= new InjectedProvider420(globalThis.ethereum);
    const accounts = await local.provider.request('eth_accounts');
    local.actor = accounts?.[0]?.toLowerCase() || null;
    if (!local.actor) { setStatus('Connect the owner wallet to manage passkeys.'); local.smartAccount = null; local.chainState = null; render(); return; }
    local.smartAccount = await discoverSmartAccount(local.provider, local.actor, local.config.smartAccount);
    if (!local.smartAccount.deployed) throw new Error('SmartAccount420 must be deployed before passkey management');
    local.chainState = await readPasskeyManagementState(local.provider, local.smartAccount.smartAccount);
    loadDevice();
    setStatus('Canonical passkey authority and local device state refreshed.');
    render();
  };

  $('#passkey-refresh').addEventListener('click', async () => {
    try { await refresh(); } catch (error) { setStatus(error.message); render(); }
  });

  $('#passkey-enroll').addEventListener('click', async () => {
    if (local.busy) return;
    local.busy = true; render();
    try {
      await refresh();
      if (local.config?.features?.passkeys !== true) throw new Error('passkey enrollment is runtime-disabled pending production qualification');
      if (!local.smartAccount.controllerIsOwner) throw new Error('connected controller is not the SmartAccount420 owner');
      if (!local.chainState.verifierConfigured) throw new Error('SmartAccount420 passkey verifier is not configured');
      const chainIdHex = await local.provider.request('eth_chainId');
      const nonce = bytesToBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(24)));
      const challenge = await buildPasskeyChallenge({
        chainId: Number(BigInt(chainIdHex)),
        smartAccount: local.smartAccount.smartAccount,
        authorizationEpoch: Number(local.chainState.authorizationEpoch),
        operation: local.device ? 'replace' : 'register',
        nonce,
      });
      setStatus('Requesting a user-verified WebAuthn credential…');
      const registration = await registerPasskeyForEnrollment({
        challenge,
        rp: rpConfig(),
        account: local.smartAccount.smartAccount,
        displayName: $('#passkey-label').value.trim() || '420 Wallet',
        excludeCredentialIds: local.device?.credentialId ? [local.device.credentialId] : [],
      });
      const review = await buildPasskeyEnrollmentReview({
        registration,
        smartAccountState: local.smartAccount,
        rp: rpConfig(),
        label: $('#passkey-label').value.trim() || 'This device',
      });
      const prompt = `${local.device ? 'Replace' : 'Enroll'} passkey for ${local.smartAccount.smartAccount}?\n\nRP: ${review.rpId}\nOrigin: ${review.origin}\nCredential hash: ${review.credentialIdHash}\nAuthorization epoch: ${review.authorizationEpoch}\n\nThe transaction will be simulated before wallet approval.`;
      if (globalThis.confirm && !globalThis.confirm(prompt)) { setStatus('Passkey enrollment cancelled before on-chain submission.'); return; }
      setStatus('Simulating passkey enrollment and requesting owner approval…');
      const submitted = await sendPasskeyEnrollment(local.provider, local.actor, local.smartAccount, review);
      setStatus(`Passkey enrollment submitted: ${submitted.txHash}. Waiting for confirmation…`);
      const confirmed = await confirmPasskeyManagementTransaction(local.provider, submitted.txHash, local.smartAccount, submitted.previousEpoch);
      const previous = local.device;
      const next = previous
        ? finalizePasskeyReplacementDevice(previous, review, confirmed.authorizationEpoch)
        : { next: finalizePasskeyEnrollmentDevice(review, confirmed.authorizationEpoch) };
      saveDevice(next.next);
      await refresh();
      setStatus('Passkey enrollment confirmed; authorization epoch and device binding re-verified.');
    } catch (error) { setStatus(error.message); }
    finally { local.busy = false; render(); }
  });

  $('#passkey-revoke').addEventListener('click', async () => {
    if (local.busy) return;
    local.busy = true; render();
    try {
      await refresh();
      if (!local.device) throw new Error('no local passkey device record to revoke');
      if (globalThis.confirm && !globalThis.confirm(`Revoke the passkey bound to ${local.smartAccount.smartAccount}? This advances the authorization epoch and immediately invalidates the credential.`)) return;
      setStatus('Simulating passkey revocation and requesting owner approval…');
      const submitted = await sendPasskeyRevocation(local.provider, local.actor, local.smartAccount);
      setStatus(`Passkey revocation submitted: ${submitted.txHash}. Waiting for confirmation…`);
      await confirmPasskeyManagementTransaction(local.provider, submitted.txHash, local.smartAccount, submitted.previousEpoch);
      saveDevice(finalizePasskeyRevocationDevice(local.device));
      await refresh();
      setStatus('Passkey revoked; authorization epoch advancement verified.');
    } catch (error) { setStatus(error.message); }
    finally { local.busy = false; render(); }
  });

  try {
    const response = await fetch('./runtime-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime config ${response.status}`);
    local.config = await response.json();
    validateRuntimeConfig(local.config);
    panel.hidden = local.config?.features?.passkeyDeviceManagement !== true;
    if (!panel.hidden) await refresh();
  } catch (error) { setStatus(error.message); render(); }
}

if (typeof document !== 'undefined') initPasskeyManagementUi();
